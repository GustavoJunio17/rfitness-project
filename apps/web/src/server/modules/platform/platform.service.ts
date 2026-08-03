import { conflictError, evaluatePassword, notFoundError, validationError } from "@rfitness/core";
import type { AccessRequestStatus } from "@prisma/client";
import { prisma } from "../../db";
import { getSupabaseAdmin } from "../../supabase/admin";
import { writeAuditLog } from "../../audit/audit-log";
import type { AuthContext } from "../../auth/context";
import { provisionGym, syncGymIdsMetadata } from "../identity/gym-provisioning";

export interface SignUpInput {
  requesterName: string;
  requesterEmail: string;
  password: string;
  phone?: string | null;
  gymName: string;
  notes?: string | null;
}

export interface AccessRequestDto {
  id: string;
  requesterName: string;
  requesterEmail: string;
  phone: string | null;
  gymName: string;
  notes: string | null;
  status: AccessRequestStatus;
  decisionReason: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  createdGymId: string | null;
  createdAt: Date;
}

export interface ApprovalResult {
  gymId: string;
  gymName: string;
  email: string;
}

/** Situação da conta de quem ainda não opera nenhuma academia. */
export interface AccessStatusDto {
  status: AccessRequestStatus;
  gymName: string;
  decisionReason: string | null;
  createdAt: Date;
}

function toDto(request: {
  id: string;
  requesterName: string;
  requesterEmail: string;
  phone: string | null;
  gymName: string;
  notes: string | null;
  status: AccessRequestStatus;
  decisionReason: string | null;
  reviewedAt: Date | null;
  createdGymId: string | null;
  createdAt: Date;
  reviewedBy: { name: string } | null;
}): AccessRequestDto {
  return {
    id: request.id,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail,
    phone: request.phone,
    gymName: request.gymName,
    notes: request.notes,
    status: request.status,
    decisionReason: request.decisionReason,
    reviewedAt: request.reviewedAt,
    reviewerName: request.reviewedBy?.name ?? null,
    createdGymId: request.createdGymId,
    createdAt: request.createdAt,
  };
}

const REQUEST_SELECT = {
  id: true,
  requesterName: true,
  requesterEmail: true,
  phone: true,
  gymName: true,
  notes: true,
  status: true,
  decisionReason: true,
  reviewedAt: true,
  createdGymId: true,
  createdAt: true,
  reviewedBy: { select: { name: true } },
} as const;

/**
 * Cadastro público de gestor.
 *
 * Cria a conta de verdade, com a senha que a pessoa escolheu — ela já consegue
 * entrar. O que fica pendente da RFitness é a academia: sem tenant, o painel não
 * tem o que mostrar nem o que gravar, então a aprovação continua sendo a
 * barreira real, sem depender de senha provisória repassada por fora.
 *
 * Aqui, ao contrário de um formulário anônimo, dizer "e-mail já cadastrado" é
 * necessário: a pessoa precisa saber que deve fazer login em vez de tentar de
 * novo.
 */
export async function signUp(input: SignUpInput): Promise<{ status: AccessRequestStatus }> {
  const email = input.requesterEmail.trim().toLowerCase();
  const name = input.requesterName.trim();
  const gymName = input.gymName.trim();

  // Mesma regra de força do resto do sistema: o medidor da tela é conveniência,
  // não barreira — quem chama a API direto passa por aqui igual.
  const strength = evaluatePassword(input.password, [name, email, gymName]);
  if (!strength.acceptable) {
    throw validationError(strength.hint ?? "Escolha uma senha mais forte.");
  }

  const existing = await prisma.accessRequest.findFirst({
    where: { requesterEmail: email },
    select: { status: true },
  });
  if (existing) {
    throw conflictError(
      existing.status === "REJECTED"
        ? "Este e-mail já teve um cadastro recusado. Fale com a administração da RFitness."
        : "Este e-mail já está cadastrado. Faça login.",
    );
  }

  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { gym_ids: [] },
    user_metadata: { name },
  });

  if (error || !data.user) {
    if (/already been registered|already exists/i.test(error?.message ?? "")) {
      throw conflictError("Este e-mail já está cadastrado. Faça login.");
    }
    throw validationError(`Não foi possível criar a conta: ${error?.message}`);
  }

  try {
    await prisma.accessRequest.create({
      data: {
        authUserId: data.user.id,
        requesterName: name,
        requesterEmail: email,
        phone: input.phone?.trim() || null,
        gymName,
        notes: input.notes?.trim() || null,
      },
    });
  } catch (dbError) {
    // Sem o pedido, a conta viraria uma credencial válida que ninguém consegue
    // aprovar — e o e-mail ficaria bloqueado para uma nova tentativa.
    await getSupabaseAdmin()
      .auth.admin.deleteUser(data.user.id)
      .catch(() => undefined);
    throw dbError;
  }

  return { status: "PENDING" };
}

/**
 * Situação do cadastro de quem está sem academia. É o que permite à interface
 * dizer "aguardando aprovação" em vez de mostrar um painel vazio.
 */
export async function getAccessStatus(authUserId: string): Promise<AccessStatusDto | null> {
  const request = await prisma.accessRequest.findUnique({
    where: { authUserId },
    select: { status: true, gymName: true, decisionReason: true, createdAt: true },
  });
  return request;
}

/**
 * Já pode operar? Vale para quem foi aprovado — e também para as contas
 * criadas antes deste fluxo, que têm academia mas nunca tiveram pedido.
 */
export async function isApproved(authUserId: string): Promise<boolean> {
  const [request, profile] = await Promise.all([
    prisma.accessRequest.findUnique({ where: { authUserId }, select: { status: true } }),
    prisma.user.findFirst({ where: { authUserId }, select: { id: true } }),
  ]);

  if (request) return request.status === "APPROVED";
  return profile !== null;
}

export async function listAccessRequests(status?: AccessRequestStatus): Promise<AccessRequestDto[]> {
  const requests = await prisma.accessRequest.findMany({
    where: status ? { status } : undefined,
    select: REQUEST_SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return requests.map(toDto);
}

async function requireReviewer(auth: AuthContext): Promise<{ id: string; name: string }> {
  const reviewer = await prisma.platformAdmin.findUnique({
    where: { authUserId: auth.authUserId },
    select: { id: true, name: true },
  });
  if (!reviewer) throw notFoundError("Admin de plataforma não encontrado.");
  return reviewer;
}

/**
 * Aprova o cadastro: provisiona a academia pedida e a entrega ao gestor.
 *
 * A conta já existe desde o cadastro, então não há senha para criar nem para
 * repassar — no próximo carregamento a academia simplesmente aparece para ele.
 */
export async function approveAccessRequest(
  auth: AuthContext,
  requestId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<ApprovalResult> {
  const reviewer = await requireReviewer(auth);

  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!request) throw notFoundError("Cadastro não encontrado.");
  if (request.status !== "PENDING") throw conflictError("Este cadastro já foi decidido.");
  if (!request.authUserId) {
    throw validationError(
      "Este cadastro é anterior ao fluxo atual e não tem conta associada. Peça para a pessoa se cadastrar de novo.",
    );
  }

  const gym = await provisionGym({
    gymName: request.gymName,
    ownerAuthUserId: request.authUserId,
    ownerName: request.requesterName,
    ownerEmail: request.requesterEmail,
  });

  await syncGymIdsMetadata(request.authUserId);

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedById: reviewer.id,
      createdGymId: gym.id,
    },
  });

  await writeAuditLog({
    gymId: gym.id,
    userId: gym.userId,
    action: "platform.access_request.approve",
    entityType: "AccessRequest",
    entityId: requestId,
    after: { gymId: gym.id, reviewer: reviewer.name },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { gymId: gym.id, gymName: gym.name, email: request.requesterEmail };
}

export async function rejectAccessRequest(
  auth: AuthContext,
  requestId: string,
  reason: string,
): Promise<AccessRequestDto> {
  const reviewer = await requireReviewer(auth);

  const request = await prisma.accessRequest.findUnique({
    where: { id: requestId },
    select: { status: true },
  });
  if (!request) throw notFoundError("Cadastro não encontrado.");
  if (request.status !== "PENDING") throw conflictError("Este cadastro já foi decidido.");

  const updated = await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: reviewer.id,
      decisionReason: reason.trim(),
    },
    select: REQUEST_SELECT,
  });

  return toDto(updated);
}

export interface PlatformGymDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  owner: { name: string; email: string } | null;
  counts: { students: number; products: number; users: number };
}

/**
 * Todas as academias da plataforma. Só cadastro e volume — faturamento e dado
 * de aluno continuam sendo do tenant, e admin de plataforma não é dono deles.
 */
export async function listPlatformGyms(): Promise<PlatformGymDto[]> {
  const gyms = await prisma.gym.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
      ownerAuthUserId: true,
      users: {
        select: { authUserId: true, name: true, email: true },
      },
      _count: { select: { students: true, products: true, users: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return gyms.map((gym) => {
    const owner = gym.users.find((user) => user.authUserId === gym.ownerAuthUserId);
    return {
      id: gym.id,
      name: gym.name,
      slug: gym.slug,
      isActive: gym.isActive,
      createdAt: gym.createdAt,
      owner: owner ? { name: owner.name, email: owner.email } : null,
      counts: {
        students: gym._count.students,
        products: gym._count.products,
        users: gym._count.users,
      },
    };
  });
}

export interface PlatformOverviewDto {
  gyms: { total: number; active: number };
  managers: number;
  requests: { pending: number; approved: number; rejected: number };
}

export async function getPlatformOverview(): Promise<PlatformOverviewDto> {
  const [total, active, owners, pending, approved, rejected] = await Promise.all([
    prisma.gym.count(),
    prisma.gym.count({ where: { isActive: true } }),
    prisma.gym.findMany({
      where: { ownerAuthUserId: { not: null } },
      select: { ownerAuthUserId: true },
      distinct: ["ownerAuthUserId"],
    }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
    prisma.accessRequest.count({ where: { status: "APPROVED" } }),
    prisma.accessRequest.count({ where: { status: "REJECTED" } }),
  ]);

  return {
    gyms: { total, active },
    managers: owners.length,
    requests: { pending, approved, rejected },
  };
}

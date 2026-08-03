import { conflictError, evaluatePassword, notFoundError, validationError } from "@rfitness/core";
import type { AccessRequestStatus } from "@prisma/client";
import { prisma } from "../../db";
import { getSupabaseAdmin } from "../../supabase/admin";
import type { AuthContext } from "../../auth/context";

export interface SignUpInput {
  requesterName: string;
  requesterEmail: string;
  password: string;
}

export interface AccessRequestDto {
  id: string;
  requesterName: string;
  requesterEmail: string;
  phone: string | null;
  gymName: string | null;
  notes: string | null;
  status: AccessRequestStatus;
  decisionReason: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  createdGymId: string | null;
  createdAt: Date;
}

export interface ApprovalResult {
  email: string;
  requesterName: string;
}

/** Situação da conta de quem ainda não opera nenhuma academia. */
export interface AccessStatusDto {
  status: AccessRequestStatus;
  decisionReason: string | null;
  createdAt: Date;
}

function toDto(request: {
  id: string;
  requesterName: string;
  requesterEmail: string;
  phone: string | null;
  gymName: string | null;
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
 * Cadastro público de gestor: nome, e-mail e senha.
 *
 * Cria a conta de verdade — a pessoa já consegue entrar —, mas travada: sem
 * liberação da RFitness ela não cria academia, e sem academia não há nada para
 * operar. A academia não é perguntada aqui de propósito; quem decide quantas
 * unidades existem, e como se chamam, é o gestor depois de liberado.
 *
 * Ao contrário de um formulário anônimo, dizer "e-mail já cadastrado" é
 * necessário: a pessoa precisa saber que deve fazer login em vez de tentar de
 * novo.
 */
export async function signUp(input: SignUpInput): Promise<{ status: AccessRequestStatus }> {
  const email = input.requesterEmail.trim().toLowerCase();
  const name = input.requesterName.trim();

  // Mesma regra de força do resto do sistema: o medidor da tela é conveniência,
  // não barreira — quem chama a API direto passa por aqui igual.
  const strength = evaluatePassword(input.password, [name, email]);
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
      data: { authUserId: data.user.id, requesterName: name, requesterEmail: email },
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
  return prisma.accessRequest.findUnique({
    where: { authUserId },
    select: { status: true, decisionReason: true, createdAt: true },
  });
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
 * Libera o cadastro.
 *
 * Aprovar é só destravar a conta — nenhuma academia é criada aqui. A pessoa já
 * tem login desde o cadastro; o que faltava era poder cadastrar as próprias
 * unidades, e é isso que passa a valer no próximo carregamento dela.
 */
export async function approveAccessRequest(
  auth: AuthContext,
  requestId: string,
): Promise<ApprovalResult> {
  const reviewer = await requireReviewer(auth);

  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!request) throw notFoundError("Cadastro não encontrado.");
  if (request.status !== "PENDING") throw conflictError("Este cadastro já foi decidido.");

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: reviewer.id },
  });

  // A decisão não vai para `audit_logs`: aquela trilha é escopada por academia,
  // e aqui ainda não existe nenhuma. O registro fica no próprio cadastro —
  // `reviewedById` e `reviewedAt` dizem quem liberou e quando.
  return { email: request.requesterEmail, requesterName: request.requesterName };
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

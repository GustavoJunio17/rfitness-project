import { randomInt } from "node:crypto";
import { conflictError, notFoundError, validationError } from "@rfitness/core";
import type { AccessRequestStatus } from "@prisma/client";
import { prisma } from "../../db";
import { getSupabaseAdmin } from "../../supabase/admin";
import { writeAuditLog } from "../../audit/audit-log";
import type { AuthContext } from "../../auth/context";
import { provisionGym, syncGymIdsMetadata } from "../identity/gym-provisioning";

export interface AccessRequestInput {
  requesterName: string;
  requesterEmail: string;
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
  /**
   * Senha provisória, mostrada **uma única vez** ao admin que aprovou, para ele
   * repassar ao gestor. `null` quando a pessoa já tinha conta (ganhou só mais
   * uma academia) e portanto continua com a senha dela.
   */
  temporaryPassword: string | null;
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const PASSWORD_SYMBOLS = "!@#$%&*?";

/**
 * Senha provisória de 16 caracteres com `randomInt` (CSPRNG). `Math.random`
 * seria previsível, e essa senha é a credencial inicial de um tenant inteiro.
 * O alfabeto omite O/0 e I/l porque ela é lida e digitada por uma pessoa.
 */
function generateTemporaryPassword(): string {
  const pick = (source: string) => source[randomInt(source.length)]!;
  const body = Array.from({ length: 14 }, () => pick(PASSWORD_ALPHABET)).join("");
  return `${body}${pick(PASSWORD_SYMBOLS)}${randomInt(10)}`;
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
 * Pedido de acesso do formulário público.
 *
 * A resposta é sempre a mesma frase, com ou sem pedido pendente do mesmo
 * e-mail: dizer "já existe um pedido" transformaria o formulário aberto num
 * oráculo de quem está entrando na plataforma.
 */
export async function submitAccessRequest(input: AccessRequestInput): Promise<{ received: true }> {
  const email = input.requesterEmail.trim().toLowerCase();

  const pending = await prisma.accessRequest.findFirst({
    where: { requesterEmail: email, status: "PENDING" },
    select: { id: true },
  });
  if (pending) return { received: true };

  await prisma.accessRequest.create({
    data: {
      requesterName: input.requesterName.trim(),
      requesterEmail: email,
      phone: input.phone?.trim() || null,
      gymName: input.gymName.trim(),
      notes: input.notes?.trim() || null,
    },
  });

  return { received: true };
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
 * Aprova o pedido: garante a conta do gestor no Supabase Auth e provisiona a
 * primeira academia dele.
 *
 * Se o e-mail já for de um gestor da plataforma, nada de conta nova — ele só
 * ganha mais uma unidade na rede, com a senha que já usa.
 */
export async function approveAccessRequest(
  auth: AuthContext,
  requestId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<ApprovalResult> {
  const reviewer = await requireReviewer(auth);

  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!request) throw notFoundError("Pedido de acesso não encontrado.");
  if (request.status !== "PENDING") throw conflictError("Este pedido já foi decidido.");

  // Um perfil existente é a prova de que a pessoa já tem conta no Auth — e o
  // caminho para descobrir o authUserId dela sem varrer a lista do Supabase.
  const existingProfile = await prisma.user.findFirst({
    where: { email: request.requesterEmail },
    select: { authUserId: true, name: true },
  });

  let authUserId = existingProfile?.authUserId ?? null;
  let temporaryPassword: string | null = null;

  if (!authUserId) {
    temporaryPassword = generateTemporaryPassword();
    const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
      email: request.requesterEmail,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: { gym_ids: [] },
      user_metadata: { name: request.requesterName },
    });

    if (error || !data.user) {
      if (/already been registered|already exists/i.test(error?.message ?? "")) {
        throw conflictError(
          "Este e-mail já existe no Supabase Auth mas não tem perfil na plataforma. Resolva o conflito antes de aprovar.",
        );
      }
      throw validationError(`Falha ao criar o acesso do gestor: ${error?.message}`);
    }
    authUserId = data.user.id;
  }

  let gym;
  try {
    gym = await provisionGym({
      gymName: request.gymName,
      ownerAuthUserId: authUserId,
      ownerName: existingProfile?.name ?? request.requesterName,
      ownerEmail: request.requesterEmail,
    });
  } catch (error) {
    // Rollback só da conta que esta aprovação criou: apagar uma conta
    // preexistente derrubaria o acesso do gestor às academias que ele já tem.
    if (temporaryPassword) {
      await getSupabaseAdmin()
        .auth.admin.deleteUser(authUserId)
        .catch(() => undefined);
    }
    throw error;
  }

  await syncGymIdsMetadata(authUserId);

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

  return {
    gymId: gym.id,
    gymName: gym.name,
    email: request.requesterEmail,
    temporaryPassword,
  };
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
  if (!request) throw notFoundError("Pedido de acesso não encontrado.");
  if (request.status !== "PENDING") throw conflictError("Este pedido já foi decidido.");

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

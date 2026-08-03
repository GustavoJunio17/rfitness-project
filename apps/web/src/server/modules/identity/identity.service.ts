import {
  conflictError,
  evaluatePassword,
  forbiddenError,
  notFoundError,
  validationError,
  type Role,
} from "@rfitness/core";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../../db";
import { getEnv } from "../../env";
import { getSupabaseAdmin } from "../../supabase/admin";
import { writeAuditLog } from "../../audit/audit-log";
import type { AuthContext, GymMembership } from "../../auth/context";
import { getAccountStatus, type AccountStatusDto } from "../platform/platform.service";
import { provisionGym, syncGymIdsMetadata } from "./gym-provisioning";

export interface GymSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isOwner: boolean;
  roles: Role[];
  createdAt: Date;
  counts: { students: number; products: number; users: number };
}

export interface CurrentUserDto {
  /** Perfil na academia ativa. `null` para admin de plataforma sem academia. */
  id: string | null;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  roles: Role[];
  gym: { id: string; name: string; slug: string; whatsappInstanceName: string | null } | null;
  memberships: GymMembership[];
  /**
   * Situação do cadastro. Só é consultada para quem está sem academia — é a
   * diferença entre "aguardando a RFitness" e "painel realmente vazio", e sem
   * ela a interface não teria como explicar por que não há nada para operar.
   */
  access: AccountStatusDto | null;
}

/**
 * Perfil da sessão atual, com a rede de academias e a unidade ativa.
 *
 * `touch` registra o acesso em `lastLoginAt`. Só a rota HTTP o passa: ela é
 * chamada quando o cliente realmente busca a sessão — logo após o login, por
 * exemplo. O layout do painel chama esta função a cada navegação, e marcar
 * "último acesso" a cada página seria uma escrita por request para registrar
 * um dado que só interessa por login.
 */
export async function getCurrentUser(
  auth: AuthContext,
  options: { touch?: boolean } = {},
): Promise<CurrentUserDto> {
  const base = {
    name: auth.name,
    email: auth.email,
    isPlatformAdmin: auth.isPlatformAdmin,
    memberships: auth.memberships,
  };

  if (!auth.gymId) {
    const access = auth.isPlatformAdmin ? null : await getAccountStatus(auth.authUserId);
    return { ...base, id: null, roles: [], gym: null, access };
  }

  // Nenhuma consulta aqui: o contexto de autenticação já carregou academia e
  // perfil ao resolver os vínculos. Buscar de novo custava duas idas ao banco
  // em série a cada carregamento de página do painel.
  const membership = auth.memberships.find((candidate) => candidate.gymId === auth.gymId);
  if (!membership) throw notFoundError("Academia não encontrada.");

  if (options.touch) {
    await prisma.user.update({
      where: { id: membership.userId },
      data: { lastLoginAt: new Date() },
    });
  }

  return {
    ...base,
    id: membership.userId,
    roles: auth.roles,
    gym: {
      id: membership.gymId,
      name: membership.gymName,
      slug: membership.gymSlug,
      whatsappInstanceName: membership.whatsappInstanceName,
    },
    access: null,
  };
}

/**
 * id do `User` (perfil) na academia ativa — usado onde o banco precisa da FK do
 * perfil (ex.: `Sale.employeeId`), não do id do Supabase.
 *
 * Sai do contexto já carregado, sem consulta: registrar uma venda ou um
 * movimento de estoque não deve custar uma ida ao banco só para descobrir de
 * quem é o perfil que a própria sessão já resolveu.
 */
export function currentProfileId(auth: AuthContext): string {
  const membership = auth.memberships.find((candidate) => candidate.gymId === auth.gymId);
  if (!membership) throw notFoundError("Perfil de usuário não encontrado nesta academia.");
  return membership.userId;
}

/** A rede do gestor: academias em que ele tem perfil, com um resumo de cada. */
export async function listMyGyms(auth: AuthContext): Promise<GymSummary[]> {
  const gymIds = auth.memberships.map((membership) => membership.gymId);
  if (gymIds.length === 0) return [];

  const gyms = await prisma.gym.findMany({
    where: { id: { in: gymIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      ownerAuthUserId: true,
      createdAt: true,
      _count: { select: { students: true, products: true, users: true } },
    },
    orderBy: { name: "asc" },
  });

  const rolesByGym = new Map(auth.memberships.map((membership) => [membership.gymId, membership.roles]));

  return gyms.map((gym) => ({
    id: gym.id,
    name: gym.name,
    slug: gym.slug,
    isActive: gym.isActive,
    isOwner: gym.ownerAuthUserId === auth.authUserId,
    roles: rolesByGym.get(gym.id) ?? [],
    createdAt: gym.createdAt,
    counts: {
      students: gym._count.students,
      products: gym._count.products,
      users: gym._count.users,
    },
  }));
}

/**
 * Nova unidade da rede do gestor.
 *
 * Quem já tem conta cria quantas academias quiser — a barreira da RFitness é a
 * entrada na plataforma (aprovação do pedido de acesso), não a abertura de mais
 * uma unidade por quem já foi aprovado.
 */
export async function createGym(
  auth: AuthContext,
  input: { name: string },
  meta: { ip: string | null; userAgent: string | null },
): Promise<GymSummary> {
  // Segunda checagem, além da de `defineRoute`: a rota é de escopo `any` (quem
  // ainda não tem academia precisa alcançá-la), então é aqui que a liberação
  // vira barreira para a criação em si.
  if (auth.accessStatus !== "ACTIVE") {
    throw forbiddenError("Sua conta ainda não foi liberada pela administração da RFitness.");
  }

  const name = input.name.trim();

  const duplicate = await prisma.gym.findFirst({
    where: { name, ownerAuthUserId: auth.authUserId },
    select: { id: true },
  });
  if (duplicate) throw conflictError("Você já tem uma academia com esse nome.");

  const gym = await provisionGym({
    gymName: name,
    owner: { authUserId: auth.authUserId, name: auth.name, email: auth.email },
  });

  await syncGymIdsMetadata(auth.authUserId);
  await writeAuditLog({
    gymId: gym.id,
    userId: gym.userId,
    action: "gym.create",
    entityType: "Gym",
    entityId: gym.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    id: gym.id,
    name: gym.name,
    slug: gym.slug,
    isActive: true,
    isOwner: true,
    roles: ["ADMIN"],
    createdAt: new Date(),
    counts: { students: 0, products: 0, users: 1 },
  };
}

/** Renomear/desativar a unidade — só o gestor dono da rede. */
export async function updateGym(
  auth: AuthContext,
  gymId: string,
  input: { name?: string; isActive?: boolean },
  meta: { ip: string | null; userAgent: string | null },
): Promise<GymSummary> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, ownerAuthUserId: true },
  });
  if (!gym) throw notFoundError("Academia não encontrada.");
  if (gym.ownerAuthUserId !== auth.authUserId) {
    throw forbiddenError("Só o gestor dono da academia pode alterá-la.");
  }

  const updated = await prisma.gym.update({
    where: { id: gymId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
      _count: { select: { students: true, products: true, users: true } },
    },
  });

  await writeAuditLog({
    gymId,
    action: "gym.update",
    entityType: "Gym",
    entityId: gymId,
    after: input,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    isOwner: true,
    roles: auth.memberships.find((membership) => membership.gymId === gymId)?.roles ?? [],
    counts: {
      students: updated._count.students,
      products: updated._count.products,
      users: updated._count.users,
    },
  };
}

/**
 * Valida a troca de unidade. O cookie é escrito pela rota; aqui só se confirma
 * que o destino é mesmo da pessoa — o resto do sistema confia em `auth.gymId`.
 */
export function assertMembership(auth: AuthContext, gymId: string): GymMembership {
  const membership = auth.memberships.find((candidate) => candidate.gymId === gymId);
  if (!membership) throw notFoundError("Você não tem acesso a esta academia.");
  return membership;
}

/**
 * Troca de senha da própria conta.
 *
 * A senha atual é conferida com um login descartável em vez de confiar só na
 * sessão: cookie roubado não deve virar troca de senha. A força da nova passa
 * pela mesma regra do resto do sistema.
 */
export async function changeOwnPassword(
  auth: AuthContext,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const strength = evaluatePassword(input.newPassword, [auth.name, auth.email]);
  if (!strength.acceptable) {
    throw validationError(strength.hint ?? "Escolha uma senha mais forte.");
  }
  if (input.currentPassword === input.newPassword) {
    throw validationError("A nova senha precisa ser diferente da atual.");
  }

  const env = getEnv();
  const verifier = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: auth.email,
    password: input.currentPassword,
  });
  if (signInError) throw validationError("Senha atual incorreta.");

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(auth.authUserId, {
    password: input.newPassword,
  });
  if (error) throw validationError(`Não foi possível alterar a senha: ${error.message}`);
}

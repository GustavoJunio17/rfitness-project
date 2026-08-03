import { cookies } from "next/headers";
import type { Role } from "@rfitness/core";
import { prisma } from "../db";
import { createSupabaseServerClient } from "../supabase/server";
import {
  ACTIVE_GYM_COOKIE,
  identityFromUser,
  normalizeRoles,
  pickActiveGym,
  type GymMembership,
} from "./identity";

export { ACTIVE_GYM_COOKIE, type GymMembership };

export type AccessStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface AuthContext {
  /** id em `auth.users` (Supabase Auth). */
  authUserId: string;
  email: string;
  name: string;

  /**
   * Liberação da conta pela RFitness. Enquanto não for `APPROVED` a sessão é
   * válida — a pessoa realmente se cadastrou — mas não dá acesso a nada.
   */
  accessStatus: AccessStatus;

  /** Admin da RFitness: administra a plataforma, não opera academia nenhuma. */
  isPlatformAdmin: boolean;

  /** Todas as academias em que a pessoa tem perfil ativo. */
  memberships: GymMembership[];

  /** Academia ativa. String vazia quando a pessoa não tem nenhuma. */
  gymId: string;

  /** Papéis **na academia ativa** — não na plataforma, não nas outras unidades. */
  roles: Role[];
}

/**
 * Vínculos ativos da pessoa, direto do banco.
 *
 * Academia inativa não entra: desativar a unidade tem que tirá-la do seletor
 * imediatamente, sem depender de o gestor deslogar para o JWT ser reemitido.
 */
async function loadMemberships(authUserId: string): Promise<GymMembership[]> {
  const profiles = await prisma.user.findMany({
    where: { authUserId, status: "ACTIVE", gym: { isActive: true } },
    select: {
      gymId: true,
      gym: { select: { name: true, slug: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
    orderBy: { gym: { name: "asc" } },
  });

  return profiles.map((profile) => ({
    gymId: profile.gymId,
    gymName: profile.gym.name,
    gymSlug: profile.gym.slug,
    roles: normalizeRoles(profile.roles.map((link) => link.role.name)),
  }));
}

/**
 * Liberação da conta.
 *
 * Quem já tem perfil em alguma academia está liberado por definição — inclusive
 * as contas anteriores a este fluxo, que nunca passaram por um cadastro. A
 * consulta ao cadastro só acontece para quem não tem vínculo nenhum, que é
 * exatamente o caso pendente.
 */
async function loadAccessStatus(authUserId: string, hasMembership: boolean): Promise<AccessStatus> {
  if (hasMembership) return "APPROVED";

  const request = await prisma.accessRequest.findUnique({
    where: { authUserId },
    select: { status: true },
  });
  return request?.status ?? "APPROVED";
}

/** Contexto da request atual, ou null se não houver sessão válida. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;

  const identity = identityFromUser(data.user);
  if (!identity) return null;

  const [memberships, platformAdmin, cookieStore] = await Promise.all([
    loadMemberships(identity.authUserId),
    prisma.platformAdmin.findUnique({
      where: { authUserId: identity.authUserId },
      select: { id: true },
    }),
    cookies(),
  ]);

  const active = pickActiveGym(memberships, cookieStore.get(ACTIVE_GYM_COOKIE)?.value ?? null);

  // Admin de plataforma não passa por liberação: quem libera é ele.
  const accessStatus =
    platformAdmin !== null
      ? "APPROVED"
      : await loadAccessStatus(identity.authUserId, memberships.length > 0);

  return {
    ...identity,
    accessStatus,
    isPlatformAdmin: platformAdmin !== null,
    memberships,
    gymId: active?.gymId ?? "",
    roles: active?.roles ?? [],
  };
}

import { isRole, type Role } from "@rfitness/core";

/** Cookie que guarda qual academia da rede o gestor está olhando agora. */
export const ACTIVE_GYM_COOKIE = "rf_active_gym";

/**
 * Vínculo de uma pessoa com uma academia, já com os papéis daquele tenant.
 *
 * Carrega também o id do perfil e a instância de WhatsApp da unidade: são os
 * dados que o painel pede logo em seguida, e buscá-los aqui — onde a consulta
 * já está sendo feita — evita duas idas extras ao banco em cada carregamento.
 */
export interface GymMembership {
  gymId: string;
  gymName: string;
  gymSlug: string;
  roles: Role[];
  /** id do `User` (perfil) desta pessoa nesta academia. */
  userId: string;
  whatsappInstanceName: string | null;
}

export interface Identity {
  /** id em `auth.users` (Supabase Auth). */
  authUserId: string;
  email: string;
  name: string;
}

interface SupabaseUserLike {
  id?: string;
  /** `getClaims` devolve o id em `sub`, não em `id`. */
  sub?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Quem é a pessoa, segundo o Supabase Auth — e só isso.
 *
 * Nada de tenant nem de papel sai daqui. O vínculo com academia vive no banco
 * (`users` + `user_roles`), porque uma pessoa pode gerenciar várias unidades e
 * um metadata copiado do JWT viraria uma segunda fonte de verdade fadada a
 * divergir da tabela de papéis.
 */
export function identityFromUser(user: SupabaseUserLike | null | undefined): Identity | null {
  if (!user) return null;

  // Aceita as duas formas porque a sessão pode vir do usuário completo do Auth
  // (`id`) ou das claims verificadas localmente (`sub`).
  const authUserId = user.id ?? user.sub;
  if (!authUserId) return null;

  const email = user.email ?? "";
  const metadataName = user.user_metadata?.name;
  const name = typeof metadataName === "string" && metadataName.length > 0 ? metadataName : email;

  return { authUserId, email, name };
}

/** Descarta papel que não existe no domínio em vez de repassá-lo adiante. */
export function normalizeRoles(values: readonly string[]): Role[] {
  const unique = new Set(values.filter((value): value is Role => isRole(value)));
  return [...unique];
}

/**
 * Academia ativa da request.
 *
 * `preferred` vem de um cookie, ou seja, do cliente — por isso só é aceito se
 * estiver entre os vínculos reais. Sem essa checagem, trocar o cookie à mão
 * seria trocar de tenant. Preferência inválida cai no primeiro vínculo em vez
 * de derrubar a sessão.
 */
export function pickActiveGym(
  memberships: readonly GymMembership[],
  preferred: string | null | undefined,
): GymMembership | null {
  if (memberships.length === 0) return null;
  const match = preferred ? memberships.find((membership) => membership.gymId === preferred) : undefined;
  return match ?? memberships[0]!;
}

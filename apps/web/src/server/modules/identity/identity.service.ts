import { evaluatePassword, notFoundError, validationError, type Role } from "@rfitness/core";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../../db";
import { getEnv } from "../../env";
import { getSupabaseAdmin } from "../../supabase/admin";
import type { AuthContext, GymMembership } from "../../auth/context";
import { getAccountStatus, type AccountStatusDto } from "../platform/platform.service";

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

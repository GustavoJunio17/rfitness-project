import { isRole, type Role } from "@rfitness/core";
import { createSupabaseServerClient } from "../supabase/server";

export interface AuthContext {
  /** id em `auth.users` (Supabase Auth). */
  authUserId: string;
  gymId: string;
  email: string;
  name: string;
  roles: Role[];
}

interface SupabaseUserLike {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Traduz o usuário do Supabase Auth no contexto do tenant.
 *
 * `gym_id` e `roles` vivem em `app_metadata` — gravado só com service role, ou
 * seja, o próprio usuário não consegue se promover a ADMIN editando o perfil.
 * Papéis desconhecidos são descartados em vez de repassados adiante.
 */
export function authContextFromUser(user: SupabaseUserLike | null | undefined): AuthContext | null {
  if (!user) return null;

  const appMetadata = user.app_metadata ?? {};
  const gymId = typeof appMetadata.gym_id === "string" ? appMetadata.gym_id : null;
  if (!gymId) return null;

  const rawRoles = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const roles = rawRoles.filter((role): role is Role => typeof role === "string" && isRole(role));

  const email = user.email ?? "";
  const metadataName = user.user_metadata?.name;
  const name = typeof metadataName === "string" && metadataName.length > 0 ? metadataName : email;

  return { authUserId: user.id, gymId, email, name, roles };
}

/** Contexto da request atual, ou null se não houver sessão válida. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return authContextFromUser(data.user);
}

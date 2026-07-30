import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../env";

let cached: SupabaseClient | null = null;

/**
 * Cliente com service role — ignora RLS e pode administrar usuários do Auth.
 * Só pode ser importado de código de servidor (cadastro de academia, upload de
 * foto, criação de funcionário). Nunca exponha em componente cliente.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const env = getEnv();
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

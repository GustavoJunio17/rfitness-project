"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cliente Supabase do browser (singleton). Usa a anon key e serve para duas
 * coisas apenas: autenticação e Realtime. Nenhuma leitura de tabela de negócio
 * passa por aqui — RLS está em deny-all para essas tabelas, e os dados vêm das
 * rotas `/api/*`, que aplicam RBAC.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidas no build do frontend.",
    );
  }

  client = createBrowserClient(url, anonKey);
  return client;
}

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "../env";

/**
 * Cliente Supabase ligado aos cookies da request (Server Components, Route
 * Handlers e Server Actions). Usa a anon key: quem autoriza é o Auth + as
 * policies, nunca esta chave.
 */
export async function createSupabaseServerClient() {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie — a renovação da sessão
          // acontece no middleware, que sim pode. Ignorar aqui é o padrão
          // recomendado pelo @supabase/ssr.
        }
      },
    },
  });
}

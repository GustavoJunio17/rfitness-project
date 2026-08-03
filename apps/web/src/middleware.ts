import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIX = "/dashboard";
const AUTH_ROUTES = ["/login", "/cadastro"];

/**
 * Nada de página autenticada pode ser guardado — nem pelo CDN, nem pelo
 * navegador, nem pelo histórico (`no-store` também desliga o bfcache).
 *
 * Sem isto, o HTML e o payload RSC do painel ficavam armazenados sem qualquer
 * vínculo com a sessão: entrar com outra conta na mesma máquina reencontrava a
 * tela da conta anterior.
 */
function denyCaching(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");

  // `Vary` sobrevive nas respostas que o próprio middleware produz (os
  // redirecionamentos); nas páginas renderizadas o Next reescreve o cabeçalho
  // com os valores dele. Não é problema: `no-store` já proíbe o armazenamento,
  // e `Vary` só importaria para uma resposta que pudesse ser guardada.
  response.headers.set("Vary", "Cookie");
  return response;
}

/**
 * Renova a sessão do Supabase a cada navegação (Server Component não pode
 * escrever cookie; middleware pode) e faz o gate das rotas de dashboard.
 *
 * A autorização real continua no servidor, por request: este middleware evita
 * renderizar o shell autenticado para quem não tem sessão, mas não é a barreira
 * de segurança — cada route handler valida sessão e papel.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Mesmo sem conseguir avaliar a sessão, a resposta não pode ser armazenada:
  // um deploy mal configurado não deve virar cache de página autenticada.
  if (!supabaseUrl || !supabaseAnonKey) return denyCaching(response);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verificação local da assinatura do JWT; a renovação do token expirado
  // continua acontecendo por baixo, e é ela que precisa dos cookies acima.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith(PROTECTED_PREFIX)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return denyCaching(NextResponse.redirect(loginUrl));
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    return denyCaching(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return denyCaching(response);
}

/**
 * O middleware faz uma chamada de rede ao Supabase (`getUser`) a cada request
 * que casa. Rodá-lo em `/api/*` era puro custo: as rotas já validam a sessão
 * por conta própria, e o resultado era duas idas ao Auth por chamada da
 * interface. Fica só onde ele serve para algo — navegação de página, onde a
 * renovação do cookie e o gate de rota acontecem.
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};

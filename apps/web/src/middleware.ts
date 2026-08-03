import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIX = "/dashboard";
const AUTH_ROUTES = ["/login", "/cadastro"];

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
  if (!supabaseUrl || !supabaseAnonKey) return response;

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
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
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

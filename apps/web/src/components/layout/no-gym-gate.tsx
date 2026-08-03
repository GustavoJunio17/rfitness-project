"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

/** Telas que funcionam sem academia ativa. */
const GYM_FREE_PREFIXES = ["/dashboard/conta", "/dashboard/plataforma"];

/**
 * Tira de telas operacionais quem está sem academia ativa.
 *
 * Sem isso, entrar em Vendas ou Estoque sem unidade selecionada renderiza a
 * tela inteira só para ela se encher de erros 409, sem pista do que fazer.
 *
 * `/dashboard` não passa por aqui: aquele desvio é feito no servidor, antes do
 * primeiro HTML. Este é o resto — conveniência de cliente, com a recusa de
 * verdade continuando nas rotas de API.
 */
export function NoGymGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    if (!session || session.gym) return;
    if (pathname === "/dashboard") return;
    if (GYM_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    router.replace(session.isPlatformAdmin ? "/dashboard/plataforma" : "/dashboard");
  }, [session, pathname, router]);

  return null;
}

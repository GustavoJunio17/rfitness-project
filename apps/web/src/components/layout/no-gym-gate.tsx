"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

/** Telas que funcionam sem academia ativa. */
const GYM_FREE_PREFIXES = [
  "/dashboard/academias",
  "/dashboard/conta",
  "/dashboard/plataforma",
];

/**
 * Tira de telas operacionais quem está sem academia ativa.
 *
 * Sem isso, o gestor com cadastro em análise cairia em Vendas ou Estoque e
 * veria só uma sequência de erros 409, sem pista do que fazer. O destino
 * depende do motivo: `/dashboard` explica cadastro pendente ou recusado,
 * `/dashboard/academias` serve a quem foi aprovado e só precisa escolher uma
 * unidade. É conveniência — a recusa de verdade continua nas rotas de API.
 */
export function NoGymGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isSuccess } = useSession();

  useEffect(() => {
    if (!isSuccess || !session || session.gym) return;
    if (pathname === "/dashboard") return;
    if (GYM_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    // Conta não liberada nem chega ao painel — o layout a redireciona antes —,
    // então quem cai aqui pode mesmo cadastrar uma academia.
    router.replace(session.isPlatformAdmin ? "/dashboard/plataforma" : "/dashboard/academias");
  }, [isSuccess, session, pathname, router]);

  return null;
}

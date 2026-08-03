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

    if (session.isPlatformAdmin) {
      router.replace("/dashboard/plataforma");
      return;
    }
    // Cadastro ainda não liberado: não adianta mandar para "minhas academias",
    // onde ele não pode criar nada.
    router.replace(session.access?.status === "APPROVED" ? "/dashboard/academias" : "/dashboard");
  }, [isSuccess, session, pathname, router]);

  return null;
}

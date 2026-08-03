"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

/** Telas que funcionam sem academia ativa. */
const GYM_FREE_PREFIXES = ["/dashboard/academias", "/dashboard/conta", "/dashboard/plataforma"];

/**
 * Manda para uma tela útil quem está sem academia ativa.
 *
 * Sem isso, o gestor recém-aprovado que perdeu o vínculo — ou o admin de
 * plataforma, que nunca teve um — cairia no dashboard e veria só uma sequência
 * de erros 409, sem pista do que fazer. O redirecionamento é de conveniência: a
 * recusa de verdade continua nas rotas de API.
 */
export function NoGymGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isSuccess } = useSession();

  useEffect(() => {
    if (!isSuccess || !session || session.gym) return;
    if (GYM_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    router.replace(session.isPlatformAdmin ? "/dashboard/plataforma" : "/dashboard/academias");
  }, [isSuccess, session, pathname, router]);

  return null;
}

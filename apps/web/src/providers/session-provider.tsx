"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/hooks/use-session";

const InitialSessionContext = createContext<SessionUser | null>(null);

/**
 * Semeia a sessão que o servidor já resolveu.
 *
 * Sem isto, o primeiro render do cliente não sabe quem está logado: o menu
 * montava a versão de gestor, o painel escolhia a tela de "sem academia", e só
 * quando `/auth/me` respondia é que tudo trocava — o piscar de tela errada na
 * entrada. O layout do dashboard já tem esse dado no servidor, então ele desce
 * junto com o HTML e a primeira pintura já é a definitiva.
 */
export function InitialSessionProvider({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  return <InitialSessionContext.Provider value={session}>{children}</InitialSessionContext.Provider>;
}

export function useInitialSession(): SessionUser | null {
  return useContext(InitialSessionContext);
}

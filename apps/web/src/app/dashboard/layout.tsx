import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth/context";
import { getCurrentUser } from "@/server/modules/identity/identity.service";
import { InitialSessionProvider } from "@/providers/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";
import { NoGymGate } from "@/components/layout/no-gym-gate";
import type { SessionUser } from "@/hooks/use-session";

// Shell autenticado depende de cookies de sessão — dinâmico por definição.
export const dynamic = "force-dynamic";

/**
 * Shell autenticado. Server Component: a sessão é validada no servidor antes de
 * qualquer render, então o dashboard nunca aparece para quem não tem tenant —
 * o middleware é só o atalho que evita a renderização.
 *
 * A sessão resolvida aqui desce para o cliente pronta. Antes, o menu e o painel
 * renderizavam sem saber quem estava logado e se corrigiam quando `/auth/me`
 * respondia — era o piscar de tela errada na entrada.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login?redirect=/dashboard");

  // Conta não liberada não vê o shell autenticado. Descobrir o bloqueio só ao
  // clicar em algo dentro do painel seria pior do que não entrar.
  if (auth.accessStatus !== "ACTIVE") redirect("/acesso-pendente");

  // `Date` atravessa a fronteira servidor→cliente como objeto, e o cliente
  // espera a string ISO que a rota HTTP devolveria — os dois caminhos precisam
  // entregar exatamente a mesma forma.
  const current = await getCurrentUser(auth);
  const session: SessionUser = {
    ...current,
    access: current.access
      ? { ...current.access, createdAt: current.access.createdAt.toISOString() }
      : null,
  };

  return (
    <InitialSessionProvider session={session}>
      <div className="flex min-h-screen">
        <RealtimeBridge />
        <NoGymGate />
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Topbar userName={auth.name} userEmail={auth.email} />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
        </div>
      </div>
    </InitialSessionProvider>
  );
}

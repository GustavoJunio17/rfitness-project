import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth/context";
import { resolveDashboardEntry } from "@/server/auth/dashboard-entry";
import { DashboardOverview } from "@/components/dashboard/overview";

export const dynamic = "force-dynamic";

/**
 * Raiz do painel.
 *
 * O desvio acontece no servidor, antes de qualquer HTML: o admin da plataforma
 * vai para o console, e quem ainda não tem unidade vai escolher uma. Antes isso
 * era decidido no cliente, então a tela de "sem academia" chegava a aparecer
 * antes de o redirecionamento acontecer — o piscar que se via ao entrar.
 */
export default async function DashboardPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login?redirect=/dashboard");

  const destination = resolveDashboardEntry(auth);
  if (destination) redirect(destination);

  return <DashboardOverview />;
}

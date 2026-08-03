import type { AuthContext } from "./context";

/**
 * Para onde cada conta vai ao abrir o painel.
 *
 * `null` significa "renderize a visão geral aqui mesmo".
 *
 * É função pura de propósito: esta é a regra que decide se alguém vê o console
 * da RFitness ou o painel da academia, e ela já foi entregue errada uma vez —
 * um gestor caiu na tela do admin. Fora de um Server Component, dá para provar
 * o comportamento em teste em vez de confiar na inspeção visual.
 */
export function resolveDashboardEntry(
  auth: Pick<AuthContext, "isPlatformAdmin" | "gymId">,
): string | null {
  // Admin de plataforma não opera academia: o lugar dele é o console, mesmo que
  // por algum motivo tenha um vínculo.
  if (auth.isPlatformAdmin) return "/dashboard/plataforma";

  // Gestor sem unidade ativa escolhe uma antes; a visão geral não teria o que
  // mostrar.
  if (!auth.gymId) return "/dashboard/academias";

  return null;
}

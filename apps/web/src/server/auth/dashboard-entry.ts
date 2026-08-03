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

  // Gestor sem academia fica em `/dashboard`, que explica a situação. Não há
  // para onde mandá-lo: quem libera o acesso a uma unidade é a administração
  // da RFitness, então não existe ação dele que resolva.
  return null;
}

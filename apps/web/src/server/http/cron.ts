import { unauthorizedError } from "@rfitness/core";
import { getEnv } from "../env";

/**
 * Rotas de cron são públicas (o agendador da Vercel não tem sessão), então a
 * autenticação é o `CRON_SECRET`: a Vercel envia `Authorization: Bearer
 * $CRON_SECRET` nas invocações agendadas. Sem segredo configurado a rota fica
 * fechada — melhor um cron que não roda do que um endpoint aberto que varre o
 * banco de todos os tenants.
 */
export function assertCronRequest(request: Request): void {
  const secret = getEnv().CRON_SECRET;
  if (!secret) {
    throw unauthorizedError("CRON_SECRET não configurado — rota de cron desabilitada.");
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    throw unauthorizedError("Requisição de cron não autorizada.");
  }
}

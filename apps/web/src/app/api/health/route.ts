import { isDomainError } from "@rfitness/core";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { defineRoute } from "@/server/http/route";

type CheckStatus = "ok" | "error";

/**
 * Health com diagnóstico: separa "faltou variável de ambiente" de "banco fora do
 * ar" de "banco sem migration". Sem isso, a única pista de um deploy quebrado é
 * o log da função.
 *
 * Devolve só o status de cada checagem — nunca nome de variável, connection
 * string ou mensagem do driver, porque a rota é pública.
 */
export const GET = defineRoute({
  public: true,
  handler: async () => {
    let config: CheckStatus = "ok";
    try {
      getEnv();
    } catch (error) {
      config = "error";
      if (!isDomainError(error)) throw error;
    }

    let database: CheckStatus = "ok";
    let migrations: CheckStatus = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
      migrations = "error";
    }

    if (database === "ok") {
      try {
        // Tabela criada pela primeira migration: se some, o banco não migrou.
        await prisma.gym.count();
      } catch {
        migrations = "error";
      }
    }

    const status = config === "ok" && database === "ok" && migrations === "ok" ? "ok" : "degraded";

    return { status, checks: { config, database, migrations }, timestamp: new Date().toISOString() };
  },
});

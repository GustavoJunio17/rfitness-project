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

    return {
      status,
      checks: { config, database, migrations },
      // Sem isto não dá para saber se a resposta veio do build atual ou de um
      // deploy antigo — ler um health obsoleto já custou horas de diagnóstico.
      build: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
        env: process.env.VERCEL_ENV ?? "development",
      },
      timestamp: new Date().toISOString(),
    };
  },
});

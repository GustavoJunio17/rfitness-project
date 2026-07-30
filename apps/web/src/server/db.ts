import { PrismaClient } from "@prisma/client";

/**
 * Singleton do Prisma. Em serverless cada instância quente reaproveita a mesma
 * conexão; em dev o cache no `globalThis` evita esgotar o pool a cada
 * hot-reload. A connection string usada é a do pooler do Supabase
 * (`?pgbouncer=true&connection_limit=1`).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from "@prisma/client";

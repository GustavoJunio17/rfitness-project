import { Prisma } from "@prisma/client";
import { round2, toNumber, validationError } from "@rfitness/core";
import { prisma } from "../../db";

export interface CashFlowEntryDto {
  id: string;
  description: string;
  amount: number;
  category: string;
  occurredAt: string;
}

/**
 * Entrada automática de receita da venda.
 *
 * `CashFlowEntry.saleId` é unique e usamos upsert: se a mesma venda for
 * reprocessada (retry de rota, reexecução de job), o fluxo de caixa não conta a
 * receita duas vezes.
 */
export async function registerSaleRevenue(gymId: string, saleId: string, amount: number): Promise<void> {
  await prisma.cashFlowEntry.upsert({
    where: { saleId },
    update: { amount: new Prisma.Decimal(round2(amount)) },
    create: {
      gymId,
      saleId,
      description: `Venda ${saleId.slice(0, 8)}`,
      category: "venda",
      amount: new Prisma.Decimal(round2(amount)),
    },
  });
}

export async function listCashFlow(gymId: string, limit = 200): Promise<CashFlowEntryDto[]> {
  const entries = await prisma.cashFlowEntry.findMany({
    where: { gymId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });

  return entries.map((entry) => ({
    id: entry.id,
    description: entry.description,
    amount: toNumber(entry.amount),
    category: entry.category,
    occurredAt: entry.occurredAt.toISOString(),
  }));
}

export async function createCashFlowEntry(
  gymId: string,
  input: { description: string; amount: number; category: string; occurredAt?: string },
): Promise<CashFlowEntryDto> {
  if (input.amount === 0) {
    throw validationError("O valor do lançamento não pode ser zero.");
  }

  const entry = await prisma.cashFlowEntry.create({
    data: {
      gymId,
      description: input.description,
      category: input.category,
      amount: new Prisma.Decimal(round2(input.amount)),
      ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}),
    },
  });

  return {
    id: entry.id,
    description: entry.description,
    amount: toNumber(entry.amount),
    category: entry.category,
    occurredAt: entry.occurredAt.toISOString(),
  };
}

/** Saldo do período: entradas + saídas (saídas já vêm negativas). */
export async function cashFlowBalance(gymId: string, from: Date, to: Date): Promise<number> {
  const result = await prisma.cashFlowEntry.aggregate({
    where: { gymId, occurredAt: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  return toNumber(result._sum.amount);
}

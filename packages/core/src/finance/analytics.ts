import { round2, sumMoney } from "../shared/money";

export type FinancePeriod = "today" | "week" | "month" | "year";

export function averageTicket(revenue: number, salesCount: number): number {
  if (salesCount <= 0) return 0;
  return round2(revenue / salesCount);
}

/**
 * Projeção **aritmética** de receita do mês: ritmo até hoje extrapolado para o
 * mês inteiro. Não é modelo preditivo nem IA — a UI precisa deixar isso claro.
 */
export function projectMonthlyRevenue(input: {
  monthToDateRevenue: number;
  dayOfMonth: number;
  daysInMonth: number;
}): number {
  if (input.dayOfMonth <= 0) return 0;
  return round2((input.monthToDateRevenue / input.dayOfMonth) * input.daysInMonth);
}

export interface HeatmapCell {
  /** 0 = domingo ... 6 = sábado (UTC). */
  weekday: number;
  hour: number;
  count: number;
  revenue: number;
}

export function buildSalesHeatmap(sales: { createdAt: Date; totalAmount: number }[]): HeatmapCell[] {
  const cells = new Map<string, HeatmapCell>();

  for (const sale of sales) {
    const weekday = sale.createdAt.getUTCDay();
    const hour = sale.createdAt.getUTCHours();
    const key = `${weekday}:${hour}`;
    const cell = cells.get(key) ?? { weekday, hour, count: 0, revenue: 0 };
    cell.count += 1;
    cell.revenue = sumMoney(cell.revenue, sale.totalAmount);
    cells.set(key, cell);
  }

  return [...cells.values()].sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
}

export interface StockValueSummary {
  investedValue: number;
  retailValue: number;
  expectedProfit: number;
  outOfStockCount: number;
  lowStockCount: number;
}

export function summarizeStockValue(
  variants: { costPrice: number; salePrice: number; currentQuantity: number; minQuantity: number }[],
): StockValueSummary {
  let investedValue = 0;
  let retailValue = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;

  for (const variant of variants) {
    investedValue = sumMoney(investedValue, round2(variant.costPrice * variant.currentQuantity));
    retailValue = sumMoney(retailValue, round2(variant.salePrice * variant.currentQuantity));
    if (variant.currentQuantity <= 0) outOfStockCount += 1;
    if (variant.currentQuantity <= variant.minQuantity) lowStockCount += 1;
  }

  return {
    investedValue,
    retailValue,
    expectedProfit: round2(retailValue - investedValue),
    outOfStockCount,
    lowStockCount,
  };
}

/** Janelas de período em UTC — o banco guarda timestamptz e a API responde em UTC. */
export function periodRange(period: FinancePeriod, now: Date): { from: Date; to: Date } {
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );

  switch (period) {
    case "today":
      break;
    case "week":
      from.setUTCDate(from.getUTCDate() - now.getUTCDay());
      break;
    case "month":
      from.setUTCDate(1);
      break;
    case "year":
      from.setUTCMonth(0, 1);
      break;
  }

  return { from, to: now };
}

export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

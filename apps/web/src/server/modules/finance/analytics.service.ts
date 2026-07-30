import {
  averageTicket,
  buildSalesHeatmap,
  daysInMonth,
  periodRange,
  projectMonthlyRevenue,
  round2,
  summarizeStockValue,
  toNumber,
  type FinancePeriod,
  type HeatmapCell,
} from "@rfitness/core";
import { prisma } from "../../db";

export interface PeriodTotals {
  revenue: number;
  profit: number;
  salesCount: number;
}

export interface FinanceSummary {
  today: PeriodTotals;
  week: PeriodTotals;
  month: PeriodTotals;
  year: PeriodTotals;
  totalRevenue: number;
  averageTicket: number;
  /** Projeção aritmética do mês (ritmo até hoje × dias do mês) — não é previsão por IA. */
  projectedMonthRevenue: number;
  stock: {
    investedValue: number;
    retailValue: number;
    expectedProfit: number;
    outOfStockCount: number;
    lowStockCount: number;
  };
  students: { active: number; newThisMonth: number };
  openOrders: number;
}

async function totalsForPeriod(gymId: string, from: Date, to: Date): Promise<PeriodTotals> {
  const result = await prisma.sale.aggregate({
    where: { gymId, createdAt: { gte: from, lte: to } },
    _sum: { totalAmount: true, totalProfit: true },
    _count: { _all: true },
  });

  return {
    revenue: toNumber(result._sum.totalAmount),
    profit: toNumber(result._sum.totalProfit),
    salesCount: result._count._all,
  };
}

export async function getFinanceSummary(gymId: string, now = new Date()): Promise<FinanceSummary> {
  const ranges: Record<FinancePeriod, { from: Date; to: Date }> = {
    today: periodRange("today", now),
    week: periodRange("week", now),
    month: periodRange("month", now),
    year: periodRange("year", now),
  };

  const [today, week, month, year, allTime, variants, activeStudents, newStudents, openOrders] =
    await Promise.all([
      totalsForPeriod(gymId, ranges.today.from, ranges.today.to),
      totalsForPeriod(gymId, ranges.week.from, ranges.week.to),
      totalsForPeriod(gymId, ranges.month.from, ranges.month.to),
      totalsForPeriod(gymId, ranges.year.from, ranges.year.to),
      prisma.sale.aggregate({ where: { gymId }, _sum: { totalAmount: true }, _count: { _all: true } }),
      prisma.productVariant.findMany({
        where: { product: { gymId } },
        select: { costPrice: true, salePrice: true, currentQuantity: true, minQuantity: true },
      }),
      prisma.student.count({ where: { gymId, status: "ACTIVE" } }),
      prisma.student.count({ where: { gymId, createdAt: { gte: ranges.month.from } } }),
      prisma.order.count({ where: { gymId, status: { in: ["PENDING", "SEPARATING", "OUT_FOR_DELIVERY"] } } }),
    ]);

  const totalRevenue = toNumber(allTime._sum.totalAmount);

  return {
    today,
    week,
    month,
    year,
    totalRevenue,
    averageTicket: averageTicket(totalRevenue, allTime._count._all),
    projectedMonthRevenue: projectMonthlyRevenue({
      monthToDateRevenue: month.revenue,
      dayOfMonth: now.getUTCDate(),
      daysInMonth: daysInMonth(now),
    }),
    stock: summarizeStockValue(
      variants.map((variant) => ({
        costPrice: toNumber(variant.costPrice),
        salePrice: toNumber(variant.salePrice),
        currentQuantity: variant.currentQuantity,
        minQuantity: variant.minQuantity,
      })),
    ),
    students: { active: activeStudents, newThisMonth: newStudents },
    openOrders,
  };
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  profit: number;
}

export async function getRevenueSeries(gymId: string, days = 30, now = new Date()): Promise<RevenuePoint[]> {
  const from = new Date(now.getTime() - (days - 1) * 86_400_000);
  from.setUTCHours(0, 0, 0, 0);

  const sales = await prisma.sale.findMany({
    where: { gymId, createdAt: { gte: from } },
    select: { createdAt: true, totalAmount: true, totalProfit: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, RevenuePoint>();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(from.getTime() + index * 86_400_000).toISOString().slice(0, 10);
    byDay.set(date, { date, revenue: 0, profit: 0 });
  }

  for (const sale of sales) {
    const key = sale.createdAt.toISOString().slice(0, 10);
    const point = byDay.get(key);
    if (!point) continue;
    point.revenue = round2(point.revenue + toNumber(sale.totalAmount));
    point.profit = round2(point.profit + toNumber(sale.totalProfit));
  }

  return [...byDay.values()];
}

export interface ProductRanking {
  variantId: string;
  sku: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export async function getTopProducts(
  gymId: string,
  limit = 5,
  order: "asc" | "desc" = "desc",
): Promise<ProductRanking[]> {
  const grouped = await prisma.saleItem.groupBy({
    by: ["variantId"],
    where: { sale: { gymId } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: order } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: grouped.map((row) => row.variantId) } },
    select: { id: true, sku: true, salePrice: true, product: { select: { name: true } } },
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return grouped.map((row) => {
    const variant = variantById.get(row.variantId);
    const quantitySold = row._sum.quantity ?? 0;
    return {
      variantId: row.variantId,
      sku: variant?.sku ?? "—",
      productName: variant?.product.name ?? "—",
      quantitySold,
      revenue: round2(toNumber(variant?.salePrice) * quantitySold),
    };
  });
}

export interface PaymentBreakdownRow {
  paymentMethod: string;
  revenue: number;
  salesCount: number;
}

export async function getPaymentBreakdown(gymId: string): Promise<PaymentBreakdownRow[]> {
  const grouped = await prisma.sale.groupBy({
    by: ["paymentMethod"],
    where: { gymId },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  return grouped.map((row) => ({
    paymentMethod: row.paymentMethod,
    revenue: toNumber(row._sum.totalAmount),
    salesCount: row._count._all,
  }));
}

export async function getSalesHeatmap(gymId: string, days = 30, now = new Date()): Promise<HeatmapCell[]> {
  const from = new Date(now.getTime() - days * 86_400_000);
  const sales = await prisma.sale.findMany({
    where: { gymId, createdAt: { gte: from } },
    select: { createdAt: true, totalAmount: true },
  });

  return buildSalesHeatmap(
    sales.map((sale) => ({ createdAt: sale.createdAt, totalAmount: toNumber(sale.totalAmount) })),
  );
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  FinanceAnalyticsRepository,
  HeatmapCell,
  PaymentMethodBreakdownEntry,
  RevenueInRange,
  RevenueSeriesPoint,
  StockShortageCounts,
  StockValuation,
  TopProduct,
} from "../../domain/repositories/finance-analytics.repository";

@Injectable()
export class PrismaFinanceAnalyticsRepository implements FinanceAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueInRange(gymId: string, from: Date, to: Date): Promise<RevenueInRange> {
    const result = await this.prisma.sale.aggregate({
      where: { gymId, createdAt: { gte: from, lte: to } },
      _sum: { totalAmount: true, totalProfit: true },
      _count: true,
    });
    return {
      revenue: Number(result._sum.totalAmount ?? 0),
      profit: Number(result._sum.totalProfit ?? 0),
      salesCount: result._count,
    };
  }

  async getRevenueSeries(gymId: string, from: Date, to: Date): Promise<RevenueSeriesPoint[]> {
    const sales = await this.prisma.sale.findMany({
      where: { gymId, createdAt: { gte: from, lte: to } },
      select: { createdAt: true, totalAmount: true },
    });

    const totalsByDate = new Map<string, number>();
    for (const sale of sales) {
      const dateKey = sale.createdAt.toISOString().slice(0, 10);
      totalsByDate.set(dateKey, (totalsByDate.get(dateKey) ?? 0) + Number(sale.totalAmount));
    }

    const series: RevenueSeriesPoint[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const dateKey = cursor.toISOString().slice(0, 10);
      series.push({ date: dateKey, revenue: totalsByDate.get(dateKey) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return series;
  }

  async getTopProducts(
    gymId: string,
    days: number,
    limit: number,
    order: "asc" | "desc",
  ): Promise<TopProduct[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: { gymId, createdAt: { gte: since } } },
      include: { variant: { include: { product: true } } },
    });

    const totalsByVariant = new Map<string, TopProduct>();
    for (const item of items) {
      const existing = totalsByVariant.get(item.variantId);
      const revenue = item.quantity * Number(item.unitPrice);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += revenue;
      } else {
        totalsByVariant.set(item.variantId, {
          variantId: item.variantId,
          sku: item.variant.sku,
          productName: item.variant.product.name,
          quantitySold: item.quantity,
          revenue,
        });
      }
    }

    const sorted = [...totalsByVariant.values()].sort((a, b) =>
      order === "desc" ? b.quantitySold - a.quantitySold : a.quantitySold - b.quantitySold,
    );
    return sorted.slice(0, limit);
  }

  async getPaymentMethodBreakdown(gymId: string): Promise<PaymentMethodBreakdownEntry[]> {
    const groups = await this.prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: { gymId },
      _sum: { totalAmount: true },
      _count: true,
    });
    return groups.map((group) => ({
      method: group.paymentMethod,
      total: Number(group._sum.totalAmount ?? 0),
      count: group._count,
    }));
  }

  async getSalesHeatmap(gymId: string, days: number): Promise<HeatmapCell[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    const sales = await this.prisma.sale.findMany({
      where: { gymId, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const counts = new Map<string, number>();
    for (const sale of sales) {
      const key = `${sale.createdAt.getDay()}-${sale.createdAt.getHours()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const cells: HeatmapCell[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        cells.push({ dayOfWeek, hour, count: counts.get(`${dayOfWeek}-${hour}`) ?? 0 });
      }
    }
    return cells;
  }

  async getStockValuation(gymId: string): Promise<StockValuation> {
    const variants = await this.prisma.productVariant.findMany({
      where: { product: { gymId } },
      select: { currentQuantity: true, costPrice: true, salePrice: true },
    });

    return variants.reduce(
      (acc, variant) => ({
        totalUnits: acc.totalUnits + variant.currentQuantity,
        investedValue: acc.investedValue + variant.currentQuantity * Number(variant.costPrice),
        stockValue: acc.stockValue + variant.currentQuantity * Number(variant.salePrice),
      }),
      { totalUnits: 0, investedValue: 0, stockValue: 0 },
    );
  }

  async getStockShortageCounts(gymId: string): Promise<StockShortageCounts> {
    const [lowStockCount, outOfStockCount] = await Promise.all([
      this.prisma.stockAlert.count({
        where: { type: "LOW_STOCK", resolvedAt: null, variant: { product: { gymId } } },
      }),
      this.prisma.productVariant.count({
        where: { product: { gymId }, currentQuantity: 0 },
      }),
    ]);
    return { lowStockCount, outOfStockCount };
  }
}

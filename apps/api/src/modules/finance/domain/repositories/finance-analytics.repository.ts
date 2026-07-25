import type { PaymentMethodType } from "@rfitness/database";

export const FINANCE_ANALYTICS_REPOSITORY = Symbol("FINANCE_ANALYTICS_REPOSITORY");

export interface RevenueInRange {
  revenue: number;
  profit: number;
  salesCount: number;
}

export interface RevenueSeriesPoint {
  date: string; // yyyy-mm-dd
  revenue: number;
}

export interface TopProduct {
  variantId: string;
  sku: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface PaymentMethodBreakdownEntry {
  method: PaymentMethodType;
  total: number;
  count: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0 (domingo) - 6 (sábado)
  hour: number; // 0-23
  count: number;
}

export interface StockValuation {
  totalUnits: number;
  investedValue: number;
  stockValue: number;
}

export interface StockShortageCounts {
  lowStockCount: number;
  outOfStockCount: number;
}

export interface FinanceAnalyticsRepository {
  getRevenueInRange(gymId: string, from: Date, to: Date): Promise<RevenueInRange>;
  getRevenueSeries(gymId: string, from: Date, to: Date): Promise<RevenueSeriesPoint[]>;
  getTopProducts(gymId: string, days: number, limit: number, order: "asc" | "desc"): Promise<TopProduct[]>;
  getPaymentMethodBreakdown(gymId: string): Promise<PaymentMethodBreakdownEntry[]>;
  getSalesHeatmap(gymId: string, days: number): Promise<HeatmapCell[]>;
  getStockValuation(gymId: string): Promise<StockValuation>;
  getStockShortageCounts(gymId: string): Promise<StockShortageCounts>;
}

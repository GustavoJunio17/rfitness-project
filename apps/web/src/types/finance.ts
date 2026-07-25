import type { PaymentMethodType } from "./sales";

export interface FinanceSummary {
  revenue: { today: number; week: number; month: number; year: number; total: number };
  profit: { today: number; week: number; month: number; year: number };
  averageTicket: number;
  projectedMonthlyRevenue: number;
  stock: { totalUnits: number; investedValue: number; stockValue: number; expectedProfit: number };
  shortages: { lowStockCount: number; outOfStockCount: number };
  students: { active: number; newThisMonth: number };
}

export interface RevenueSeriesPoint {
  date: string;
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
  dayOfWeek: number;
  hour: number;
  count: number;
}

export interface CashFlowEntry {
  id: string;
  gymId: string;
  description: string;
  amount: string;
  category: string;
  occurredAt: string;
  runningBalance: string;
}

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
  /** Projeção aritmética do mês (ritmo até hoje), não previsão por IA. */
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

export interface RevenueSeriesPoint {
  date: string;
  revenue: number;
  profit: number;
}

export interface TopProduct {
  variantId: string;
  sku: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface PaymentMethodBreakdownEntry {
  paymentMethod: string;
  revenue: number;
  salesCount: number;
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  count: number;
  revenue: number;
}

export interface CashFlowEntry {
  id: string;
  description: string;
  amount: number;
  category: string;
  occurredAt: string;
}

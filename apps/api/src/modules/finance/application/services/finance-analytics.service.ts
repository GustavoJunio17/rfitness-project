import { Inject, Injectable } from "@nestjs/common";
import { StudentsService } from "../../../students/application/services/students.service";
import {
  FINANCE_ANALYTICS_REPOSITORY,
  FinanceAnalyticsRepository,
  HeatmapCell,
  PaymentMethodBreakdownEntry,
  RevenueSeriesPoint,
  TopProduct,
} from "../../domain/repositories/finance-analytics.repository";

export interface FinanceSummary {
  revenue: { today: number; week: number; month: number; year: number; total: number };
  profit: { today: number; week: number; month: number; year: number };
  averageTicket: number;
  /** Simple arithmetic projection (month-to-date ÷ elapsed days × days in month) — not a predictive model. */
  projectedMonthlyRevenue: number;
  stock: { totalUnits: number; investedValue: number; stockValue: number; expectedProfit: number };
  shortages: { lowStockCount: number; outOfStockCount: number };
  students: { active: number; newThisMonth: number };
}

const TOP_PRODUCTS_LOOKBACK_DAYS = 90;

@Injectable()
export class FinanceAnalyticsService {
  constructor(
    @Inject(FINANCE_ANALYTICS_REPOSITORY) private readonly analytics: FinanceAnalyticsRepository,
    private readonly studentsService: StudentsService,
  ) {}

  async getSummary(gymId: string): Promise<FinanceSummary> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 86_400_000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const epoch = new Date(0);

    const [today, week, month, year, total, stockValuation, shortages, activeStudents, newStudents] =
      await Promise.all([
        this.analytics.getRevenueInRange(gymId, startOfToday, now),
        this.analytics.getRevenueInRange(gymId, startOfWeek, now),
        this.analytics.getRevenueInRange(gymId, startOfMonth, now),
        this.analytics.getRevenueInRange(gymId, startOfYear, now),
        this.analytics.getRevenueInRange(gymId, epoch, now),
        this.analytics.getStockValuation(gymId),
        this.analytics.getStockShortageCounts(gymId),
        this.studentsService.getActiveCount(gymId),
        this.studentsService.getNewEnrollmentsSince(gymId, startOfMonth),
      ]);

    const daysElapsedInMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthlyRevenue =
      daysElapsedInMonth > 0 ? (month.revenue / daysElapsedInMonth) * daysInMonth : 0;

    return {
      revenue: {
        today: today.revenue,
        week: week.revenue,
        month: month.revenue,
        year: year.revenue,
        total: total.revenue,
      },
      profit: { today: today.profit, week: week.profit, month: month.profit, year: year.profit },
      averageTicket: month.salesCount > 0 ? month.revenue / month.salesCount : 0,
      projectedMonthlyRevenue,
      stock: {
        totalUnits: stockValuation.totalUnits,
        investedValue: stockValuation.investedValue,
        stockValue: stockValuation.stockValue,
        expectedProfit: stockValuation.stockValue - stockValuation.investedValue,
      },
      shortages,
      students: { active: activeStudents, newThisMonth: newStudents },
    };
  }

  getRevenueSeries(gymId: string, days: number): Promise<RevenueSeriesPoint[]> {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    return this.analytics.getRevenueSeries(gymId, from, to);
  }

  getTopProducts(gymId: string, limit: number, order: "asc" | "desc"): Promise<TopProduct[]> {
    return this.analytics.getTopProducts(gymId, TOP_PRODUCTS_LOOKBACK_DAYS, limit, order);
  }

  getPaymentMethodBreakdown(gymId: string): Promise<PaymentMethodBreakdownEntry[]> {
    return this.analytics.getPaymentMethodBreakdown(gymId);
  }

  getSalesHeatmap(gymId: string, days: number): Promise<HeatmapCell[]> {
    return this.analytics.getSalesHeatmap(gymId, days);
  }
}

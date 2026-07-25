import { FinanceAnalyticsService } from "./finance-analytics.service";
import type { FinanceAnalyticsRepository } from "../../domain/repositories/finance-analytics.repository";
import type { StudentsService } from "../../../students/application/services/students.service";

describe("FinanceAnalyticsService", () => {
  let analytics: jest.Mocked<FinanceAnalyticsRepository>;
  let studentsService: jest.Mocked<StudentsService>;
  let service: FinanceAnalyticsService;

  beforeEach(() => {
    analytics = {
      getRevenueInRange: jest.fn().mockResolvedValue({ revenue: 1000, profit: 400, salesCount: 10 }),
      getRevenueSeries: jest.fn(),
      getTopProducts: jest.fn(),
      getPaymentMethodBreakdown: jest.fn(),
      getSalesHeatmap: jest.fn(),
      getStockValuation: jest.fn().mockResolvedValue({ totalUnits: 50, investedValue: 2000, stockValue: 5000 }),
      getStockShortageCounts: jest.fn().mockResolvedValue({ lowStockCount: 3, outOfStockCount: 1 }),
    };
    studentsService = {
      getActiveCount: jest.fn().mockResolvedValue(42),
      getNewEnrollmentsSince: jest.fn().mockResolvedValue(7),
    } as unknown as jest.Mocked<StudentsService>;
    service = new FinanceAnalyticsService(analytics, studentsService);
  });

  it("aggregates revenue/profit for all periods and computes derived metrics", async () => {
    const now = new Date();
    const daysElapsedInMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const expectedProjection = (1000 / daysElapsedInMonth) * daysInMonth;

    const summary = await service.getSummary("gym-1");

    expect(analytics.getRevenueInRange).toHaveBeenCalledTimes(5);
    expect(summary.revenue).toEqual({ today: 1000, week: 1000, month: 1000, year: 1000, total: 1000 });
    expect(summary.profit).toEqual({ today: 400, week: 400, month: 400, year: 400 });
    expect(summary.averageTicket).toBe(100);
    expect(summary.projectedMonthlyRevenue).toBeCloseTo(expectedProjection, 5);
    expect(summary.stock).toEqual({
      totalUnits: 50,
      investedValue: 2000,
      stockValue: 5000,
      expectedProfit: 3000,
    });
    expect(summary.shortages).toEqual({ lowStockCount: 3, outOfStockCount: 1 });
    expect(summary.students).toEqual({ active: 42, newThisMonth: 7 });
  });

  it("returns zero average ticket when there were no sales in the month", async () => {
    analytics.getRevenueInRange.mockResolvedValue({ revenue: 0, profit: 0, salesCount: 0 });

    const summary = await service.getSummary("gym-1");

    expect(summary.averageTicket).toBe(0);
    expect(summary.projectedMonthlyRevenue).toBe(0);
  });

  it("delegates revenue series to the repository with a 30-day window by default", () => {
    analytics.getRevenueSeries.mockResolvedValue([]);
    service.getRevenueSeries("gym-1", 30);
    expect(analytics.getRevenueSeries).toHaveBeenCalledWith(
      "gym-1",
      expect.any(Date),
      expect.any(Date),
    );
  });

  it("delegates top products with the fixed 90-day lookback window", () => {
    analytics.getTopProducts.mockResolvedValue([]);
    service.getTopProducts("gym-1", 5, "desc");
    expect(analytics.getTopProducts).toHaveBeenCalledWith("gym-1", 90, 5, "desc");
  });
});

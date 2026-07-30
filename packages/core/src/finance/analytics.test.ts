import { describe, expect, it } from "vitest";
import {
  averageTicket,
  projectMonthlyRevenue,
  buildSalesHeatmap,
  summarizeStockValue,
  periodRange,
} from "./analytics";

describe("averageTicket", () => {
  it("divide receita por número de vendas", () => {
    expect(averageTicket(1000, 4)).toBe(250);
  });

  it("devolve zero sem vendas (não divide por zero)", () => {
    expect(averageTicket(0, 0)).toBe(0);
    expect(averageTicket(100, 0)).toBe(0);
  });

  it("arredonda em centavos", () => {
    expect(averageTicket(100, 3)).toBe(33.33);
  });
});

describe("projectMonthlyRevenue", () => {
  it("projeta linearmente pelo ritmo do mês", () => {
    expect(projectMonthlyRevenue({ monthToDateRevenue: 3000, dayOfMonth: 10, daysInMonth: 30 })).toBe(9000);
  });

  it("no último dia do mês projeta o próprio realizado", () => {
    expect(projectMonthlyRevenue({ monthToDateRevenue: 5000, dayOfMonth: 31, daysInMonth: 31 })).toBe(5000);
  });

  it("não divide por zero quando o dia é zero", () => {
    expect(projectMonthlyRevenue({ monthToDateRevenue: 0, dayOfMonth: 0, daysInMonth: 30 })).toBe(0);
  });
});

describe("buildSalesHeatmap", () => {
  it("agrupa vendas por dia da semana e hora", () => {
    const heatmap = buildSalesHeatmap([
      { createdAt: new Date("2026-07-27T10:15:00.000Z"), totalAmount: 100 },
      { createdAt: new Date("2026-07-27T10:45:00.000Z"), totalAmount: 50 },
      { createdAt: new Date("2026-07-28T18:00:00.000Z"), totalAmount: 30 },
    ]);

    const monday10 = heatmap.find((cell) => cell.weekday === 1 && cell.hour === 10);
    expect(monday10).toEqual({ weekday: 1, hour: 10, count: 2, revenue: 150 });

    const tuesday18 = heatmap.find((cell) => cell.weekday === 2 && cell.hour === 18);
    expect(tuesday18).toEqual({ weekday: 2, hour: 18, count: 1, revenue: 30 });
  });

  it("devolve lista vazia sem vendas", () => {
    expect(buildSalesHeatmap([])).toEqual([]);
  });
});

describe("summarizeStockValue", () => {
  it("soma valor investido, valor de venda e lucro esperado", () => {
    const result = summarizeStockValue([
      { costPrice: 10, salePrice: 25, currentQuantity: 4, minQuantity: 2 },
      { costPrice: 5, salePrice: 8, currentQuantity: 0, minQuantity: 1 },
      { costPrice: 2, salePrice: 3, currentQuantity: 1, minQuantity: 3 },
    ]);

    expect(result.investedValue).toBe(42);
    expect(result.retailValue).toBe(103);
    expect(result.expectedProfit).toBe(61);
    expect(result.outOfStockCount).toBe(1);
    expect(result.lowStockCount).toBe(2);
  });

  it("zera tudo sem SKUs", () => {
    expect(summarizeStockValue([])).toEqual({
      investedValue: 0,
      retailValue: 0,
      expectedProfit: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
    });
  });
});

describe("periodRange", () => {
  const now = new Date("2026-07-29T15:30:00.000Z");

  it("today começa à meia-noite do dia", () => {
    const { from, to } = periodRange("today", now);
    expect(from.toISOString()).toBe("2026-07-29T00:00:00.000Z");
    expect(to).toEqual(now);
  });

  it("week começa no domingo da semana corrente", () => {
    expect(periodRange("week", now).from.toISOString()).toBe("2026-07-26T00:00:00.000Z");
  });

  it("month começa no dia 1", () => {
    expect(periodRange("month", now).from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("year começa em 1º de janeiro", () => {
    expect(periodRange("year", now).from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

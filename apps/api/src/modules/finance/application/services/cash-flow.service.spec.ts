import { CashFlowService } from "./cash-flow.service";
import type { CashFlowEntry, CashFlowRepository } from "../../domain/repositories/cash-flow.repository";

function buildEntry(overrides: Partial<CashFlowEntry>): CashFlowEntry {
  return {
    id: "entry-1",
    gymId: "gym-1",
    description: "Entrada",
    amount: "0",
    category: "geral",
    occurredAt: new Date(),
    ...overrides,
  };
}

describe("CashFlowService", () => {
  let cashFlow: jest.Mocked<CashFlowRepository>;
  let service: CashFlowService;

  beforeEach(() => {
    cashFlow = { create: jest.fn(), findMany: jest.fn() };
    service = new CashFlowService(cashFlow);
  });

  it("creates a manual entry with the given description/amount/category", async () => {
    cashFlow.create.mockResolvedValue(buildEntry({ amount: "-150" }));

    await service.createManualEntry("gym-1", { description: "Aluguel", amount: -150, category: "aluguel" });

    expect(cashFlow.create).toHaveBeenCalledWith({
      gymId: "gym-1",
      description: "Aluguel",
      amount: -150,
      category: "aluguel",
    });
  });

  it("registers sale revenue under the 'venda' category", async () => {
    cashFlow.create.mockResolvedValue(buildEntry({ amount: "230" }));

    await service.registerSaleRevenue("gym-1", "sale-1", 230);

    expect(cashFlow.create).toHaveBeenCalledWith(
      expect.objectContaining({ gymId: "gym-1", amount: 230, category: "venda" }),
    );
  });

  it("computes a running balance in chronological order and returns entries newest-first", async () => {
    const day1 = buildEntry({ id: "e1", amount: "50", occurredAt: new Date("2026-01-01") });
    const day2 = buildEntry({ id: "e2", amount: "-30", occurredAt: new Date("2026-01-02") });
    const day3 = buildEntry({ id: "e3", amount: "100", occurredAt: new Date("2026-01-03") });
    // Repository already orders newest-first, matching a real `orderBy: { occurredAt: "desc" }` query.
    cashFlow.findMany.mockResolvedValue([day3, day2, day1]);

    const result = await service.listWithRunningBalance("gym-1");

    expect(result.map((e) => [e.id, e.runningBalance])).toEqual([
      ["e3", "120.00"],
      ["e2", "20.00"],
      ["e1", "50.00"],
    ]);
  });
});

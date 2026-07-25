import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { LowStockAlertService } from "../../../inventory/application/services/low-stock-alert.service";
import type { CashFlowService } from "../../../finance/application/services/cash-flow.service";
import type { RealtimeService } from "../../../../shared/realtime/realtime.service";
import type { SaleRepository, SellableVariant } from "../../domain/repositories/sale.repository";
import type { StockAlertRepository } from "../../../inventory/domain/repositories/stock-alert.repository";

function buildVariant(overrides: Partial<SellableVariant> = {}): SellableVariant {
  return {
    id: "variant-1",
    sku: "WHEY-CHOCO-ABC123",
    minQuantity: 5,
    currentQuantity: 20,
    costPrice: "45.00",
    salePrice: "90.00",
    ...overrides,
  };
}

describe("SalesService", () => {
  let sales: jest.Mocked<SaleRepository>;
  let alerts: jest.Mocked<StockAlertRepository>;
  let service: SalesService;

  beforeEach(() => {
    sales = {
      findSellableVariants: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
    };
    alerts = {
      findOpenByVariantAndType: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      resolve: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
    };

    const cashFlowService = {
      registerSaleRevenue: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CashFlowService>;
    const realtimeService = { emitToGym: jest.fn() } as unknown as jest.Mocked<RealtimeService>;

    service = new SalesService(sales, new LowStockAlertService(alerts), cashFlowService, realtimeService);
  });

  function mockCreate() {
    sales.create.mockImplementation((input) =>
      Promise.resolve({
        id: "sale-1",
        gymId: input.gymId,
        studentId: input.studentId ?? null,
        employeeId: input.employeeId,
        paymentMethod: input.paymentMethod,
        discount: input.discount.toString(),
        totalAmount: input.totalAmount.toString(),
        totalProfit: input.totalProfit.toString(),
        createdAt: new Date(),
        items: input.lines.map((line, i) => ({
          id: `item-${i}`,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toString(),
          unitCost: line.unitCost.toString(),
        })),
      }),
    );
  }

  it("computes total and profit for a single-item sale without discount", async () => {
    sales.findSellableVariants.mockResolvedValue([buildVariant()]);
    mockCreate();

    await service.createSale("gym-1", "user-1", {
      paymentMethod: "CASH",
      items: [{ variantId: "variant-1", quantity: 2 }],
    });

    expect(sales.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discount: 0,
        totalAmount: 180,
        totalProfit: 90,
      }),
    );
  });

  it("subtracts the discount from both total and profit", async () => {
    sales.findSellableVariants.mockResolvedValue([buildVariant()]);
    mockCreate();

    await service.createSale("gym-1", "user-1", {
      paymentMethod: "PIX",
      discount: 20,
      items: [{ variantId: "variant-1", quantity: 2 }],
    });

    expect(sales.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 160, totalProfit: 70 }),
    );
  });

  it("rejects a discount greater than the subtotal", async () => {
    sales.findSellableVariants.mockResolvedValue([buildVariant()]);

    await expect(
      service.createSale("gym-1", "user-1", {
        paymentMethod: "CASH",
        discount: 1000,
        items: [{ variantId: "variant-1", quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sales.create).not.toHaveBeenCalled();
  });

  it("merges duplicate cart lines for the same SKU before validating stock", async () => {
    sales.findSellableVariants.mockResolvedValue([buildVariant({ currentQuantity: 5 })]);
    mockCreate();

    await service.createSale("gym-1", "user-1", {
      paymentMethod: "CASH",
      items: [
        { variantId: "variant-1", quantity: 2 },
        { variantId: "variant-1", quantity: 3 },
      ],
    });

    expect(sales.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [expect.objectContaining({ variantId: "variant-1", quantity: 5, resultingQuantity: 0 })],
      }),
    );
  });

  it("rejects a sale when requested quantity exceeds current stock", async () => {
    sales.findSellableVariants.mockResolvedValue([buildVariant({ currentQuantity: 1 })]);

    await expect(
      service.createSale("gym-1", "user-1", {
        paymentMethod: "CASH",
        items: [{ variantId: "variant-1", quantity: 5 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sales.create).not.toHaveBeenCalled();
  });

  it("rejects a sale referencing a SKU that does not belong to the gym", async () => {
    sales.findSellableVariants.mockResolvedValue([]);

    await expect(
      service.createSale("gym-1", "user-1", {
        paymentMethod: "CASH",
        items: [{ variantId: "ghost", quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("opens a LOW_STOCK alert when the sale drops stock at or below the minimum", async () => {
    sales.findSellableVariants.mockResolvedValue([buildVariant({ currentQuantity: 6, minQuantity: 5 })]);
    mockCreate();

    await service.createSale("gym-1", "user-1", {
      paymentMethod: "CASH",
      items: [{ variantId: "variant-1", quantity: 2 }],
    });

    expect(alerts.create).toHaveBeenCalledWith(expect.objectContaining({ variantId: "variant-1", type: "LOW_STOCK" }));
  });

  it("getSale throws when the sale does not belong to the gym", async () => {
    sales.findById.mockResolvedValue(null);

    await expect(service.getSale("gym-1", "sale-x")).rejects.toBeInstanceOf(NotFoundException);
  });
});

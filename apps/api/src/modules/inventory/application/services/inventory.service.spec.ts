import { BadRequestException, NotFoundException } from "@nestjs/common";
import { StockMovementType } from "@rfitness/database";
import { InventoryService } from "./inventory.service";
import { LowStockAlertService } from "./low-stock-alert.service";
import type { StockVariantRepository, StockVariantSnapshot } from "../../domain/repositories/stock-variant.repository";
import type { StockMovementRepository } from "../../domain/repositories/stock-movement.repository";
import type { StockAlertRepository } from "../../domain/repositories/stock-alert.repository";

function buildVariant(overrides: Partial<StockVariantSnapshot> = {}): StockVariantSnapshot {
  return {
    id: "variant-1",
    gymId: "gym-1",
    sku: "WHEY-CHOCO-ABC123",
    minQuantity: 10,
    maxQuantity: 100,
    currentQuantity: 20,
    expiresAt: null,
    ...overrides,
  };
}

describe("InventoryService", () => {
  let variants: jest.Mocked<StockVariantRepository>;
  let movements: jest.Mocked<StockMovementRepository>;
  let alerts: jest.Mocked<StockAlertRepository>;
  let service: InventoryService;

  beforeEach(() => {
    variants = {
      findById: jest.fn(),
      listAllWithStock: jest.fn(),
    };
    movements = {
      createAndApplyQuantity: jest.fn(),
      findMany: jest.fn(),
      countByTypesSince: jest.fn(),
    } as unknown as jest.Mocked<StockMovementRepository>;
    alerts = {
      findOpenByVariantAndType: jest.fn(),
      create: jest.fn(),
      resolve: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
    };

    service = new InventoryService(variants, movements, alerts, new LowStockAlertService(alerts));
  });

  function mockCreateAndApply() {
    movements.createAndApplyQuantity.mockImplementation((input, resultingQuantity) =>
      Promise.resolve({
        id: "movement-1",
        variantId: input.variantId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason ?? null,
        createdById: input.createdById ?? null,
        createdAt: new Date(),
        __resultingQuantity: resultingQuantity,
      } as never),
    );
  }

  it("adds stock for an IN movement and records the positive delta", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 20, minQuantity: 10 }));
    alerts.findOpenByVariantAndType.mockResolvedValue(null);
    mockCreateAndApply();

    await service.registerMovement("gym-1", { variantId: "variant-1", type: StockMovementType.IN, quantity: 5 }, "user-1");

    expect(movements.createAndApplyQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ type: StockMovementType.IN, quantity: 5 }),
      25,
    );
    expect(alerts.create).not.toHaveBeenCalled();
  });

  it("rejects an IN movement with non-positive quantity", async () => {
    variants.findById.mockResolvedValue(buildVariant());

    await expect(
      service.registerMovement("gym-1", { variantId: "variant-1", type: StockMovementType.IN, quantity: 0 }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("subtracts stock for an OUT movement", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 20, minQuantity: 10 }));
    alerts.findOpenByVariantAndType.mockResolvedValue(null);
    mockCreateAndApply();

    await service.registerMovement("gym-1", { variantId: "variant-1", type: StockMovementType.OUT, quantity: 5 }, "user-1");

    expect(movements.createAndApplyQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ type: StockMovementType.OUT, quantity: -5 }),
      15,
    );
  });

  it("rejects an OUT movement that would leave stock negative", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 3, minQuantity: 10 }));

    await expect(
      service.registerMovement("gym-1", { variantId: "variant-1", type: StockMovementType.OUT, quantity: 10 }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(movements.createAndApplyQuantity).not.toHaveBeenCalled();
  });

  it("creates a LOW_STOCK alert when a movement drops quantity at or below the minimum", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 12, minQuantity: 10 }));
    alerts.findOpenByVariantAndType.mockResolvedValue(null);
    mockCreateAndApply();

    await service.registerMovement("gym-1", { variantId: "variant-1", type: StockMovementType.OUT, quantity: 5 }, "user-1");

    expect(alerts.create).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: "variant-1", type: "LOW_STOCK" }),
    );
  });

  it("does not duplicate a LOW_STOCK alert if one is already open", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 12, minQuantity: 10 }));
    alerts.findOpenByVariantAndType.mockResolvedValue({
      id: "alert-1",
      variantId: "variant-1",
      type: "LOW_STOCK",
      message: "already open",
      resolvedAt: null,
      createdAt: new Date(),
    });
    mockCreateAndApply();

    await service.registerMovement("gym-1", { variantId: "variant-1", type: StockMovementType.OUT, quantity: 5 }, "user-1");

    expect(alerts.create).not.toHaveBeenCalled();
  });

  it("resolves an open LOW_STOCK alert once stock recovers above the minimum", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 5, minQuantity: 10 }));
    alerts.findOpenByVariantAndType.mockResolvedValue({
      id: "alert-1",
      variantId: "variant-1",
      type: "LOW_STOCK",
      message: "open",
      resolvedAt: null,
      createdAt: new Date(),
    });
    mockCreateAndApply();

    await service.registerMovement("gym-1", { variantId: "variant-1", type: StockMovementType.IN, quantity: 20 }, "user-1");

    expect(alerts.resolve).toHaveBeenCalledWith("alert-1");
  });

  it("allows a negative EXCHANGE quantity as a net decrease", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 20, minQuantity: 10 }));
    alerts.findOpenByVariantAndType.mockResolvedValue(null);
    mockCreateAndApply();

    await service.registerMovement(
      "gym-1",
      { variantId: "variant-1", type: StockMovementType.EXCHANGE, quantity: -3 },
      "user-1",
    );

    expect(movements.createAndApplyQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ type: StockMovementType.EXCHANGE, quantity: -3 }),
      17,
    );
  });

  it("treats INVENTORY_ADJUSTMENT quantity as the counted total and stores the delta", async () => {
    variants.findById.mockResolvedValue(buildVariant({ currentQuantity: 20, minQuantity: 10 }));
    alerts.findOpenByVariantAndType.mockResolvedValue(null);
    mockCreateAndApply();

    await service.registerMovement(
      "gym-1",
      { variantId: "variant-1", type: StockMovementType.INVENTORY_ADJUSTMENT, quantity: 17 },
      "user-1",
    );

    expect(movements.createAndApplyQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ type: StockMovementType.INVENTORY_ADJUSTMENT, quantity: -3 }),
      17,
    );
  });

  it("throws NotFoundException when the variant does not exist", async () => {
    variants.findById.mockResolvedValue(null);

    await expect(
      service.registerMovement("gym-1", { variantId: "ghost", type: StockMovementType.IN, quantity: 1 }, "user-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("resolveAlert throws when the alert does not belong to the gym", async () => {
    alerts.findById.mockResolvedValue(null);

    await expect(service.resolveAlert("gym-1", "alert-x")).rejects.toBeInstanceOf(NotFoundException);
    expect(alerts.resolve).not.toHaveBeenCalled();
  });
});

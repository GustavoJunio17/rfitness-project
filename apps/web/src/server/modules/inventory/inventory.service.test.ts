import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInventoryService } from "./inventory.service";
import type { InventoryEvents, InventoryRepository, VariantSnapshot } from "./inventory.ports";

const variant = (overrides: Partial<VariantSnapshot> = {}): VariantSnapshot => ({
  id: "var-1",
  gymId: "gym-1",
  sku: "WHE-GRO-BAU-900G",
  minQuantity: 5,
  currentQuantity: 10,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

function makeRepo(overrides: Partial<InventoryRepository> = {}) {
  const repo: InventoryRepository = {
    findVariant: vi.fn().mockResolvedValue(variant()),
    applyMovement: vi.fn().mockImplementation(async (input) => ({
      id: "mov-1",
      variantId: input.variantId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
      createdAt: new Date(),
      sku: "WHE-GRO-BAU-900G",
      productName: "Whey",
    })),
    listMovements: vi.fn().mockResolvedValue([]),
    findOpenAlert: vi.fn().mockResolvedValue(null),
    createAlert: vi.fn().mockResolvedValue({ id: "alert-1" }),
    resolveAlert: vi.fn().mockResolvedValue(undefined),
    listAlerts: vi.fn().mockResolvedValue([]),
    findAlert: vi.fn().mockResolvedValue({ id: "alert-1", resolvedAt: null }),
    ...overrides,
  };
  return repo;
}

function makeEvents(): InventoryEvents {
  return { publish: vi.fn().mockResolvedValue(undefined), notify: vi.fn().mockResolvedValue(undefined) };
}

describe("registerMovement", () => {
  let repo: InventoryRepository;
  let events: InventoryEvents;

  beforeEach(() => {
    repo = makeRepo();
    events = makeEvents();
  });

  it("grava o delta real e o estoque resultante para uma entrada", async () => {
    const service = createInventoryService(repo, events);

    await service.registerMovement("gym-1", { variantId: "var-1", type: "IN", quantity: 5 }, "user-1");

    expect(repo.applyMovement).toHaveBeenCalledWith({
      variantId: "var-1",
      type: "IN",
      quantity: 5,
      reason: null,
      createdById: "user-1",
      resultingQuantity: 15,
    });
  });

  it("saída grava delta negativo", async () => {
    const service = createInventoryService(repo, events);

    await service.registerMovement("gym-1", { variantId: "var-1", type: "OUT", quantity: 4 }, "user-1");

    expect(repo.applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: -4, resultingQuantity: 6 }),
    );
  });

  it("ajuste de inventário usa a contagem física como alvo", async () => {
    const service = createInventoryService(repo, events);

    await service.registerMovement(
      "gym-1",
      { variantId: "var-1", type: "INVENTORY_ADJUSTMENT", quantity: 7 },
      "user-1",
    );

    expect(repo.applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: -3, resultingQuantity: 7 }),
    );
  });

  it("recusa movimentação que deixaria o estoque negativo", async () => {
    const service = createInventoryService(repo, events);

    await expect(
      service.registerMovement("gym-1", { variantId: "var-1", type: "OUT", quantity: 11 }, "user-1"),
    ).rejects.toThrow(/insuficiente/i);

    expect(repo.applyMovement).not.toHaveBeenCalled();
  });

  it("recusa SKU de outra academia", async () => {
    repo = makeRepo({ findVariant: vi.fn().mockResolvedValue(null) });
    const service = createInventoryService(repo, events);

    await expect(
      service.registerMovement("gym-1", { variantId: "var-x", type: "IN", quantity: 1 }, "user-1"),
    ).rejects.toThrow(/não encontrado/i);
  });

  it("abre alerta de estoque baixo e notifica quando cruza o mínimo", async () => {
    const service = createInventoryService(repo, events);

    await service.registerMovement("gym-1", { variantId: "var-1", type: "OUT", quantity: 6 }, "user-1");

    expect(repo.createAlert).toHaveBeenCalledWith({
      variantId: "var-1",
      type: "LOW_STOCK",
      message: "Estoque baixo: WHE-GRO-BAU-900G (4/5)",
    });
    expect(events.notify).toHaveBeenCalledWith(
      "gym-1",
      "LOW_STOCK",
      "Estoque baixo",
      "Estoque baixo: WHE-GRO-BAU-900G (4/5)",
    );
    expect(events.publish).toHaveBeenCalledWith("gym-1", "stock.alert.created", {
      variantId: "var-1",
      type: "LOW_STOCK",
    });
  });

  it("não duplica alerta de estoque baixo já aberto", async () => {
    repo = makeRepo({ findOpenAlert: vi.fn().mockResolvedValue({ id: "alert-1" }) });
    const service = createInventoryService(repo, events);

    await service.registerMovement("gym-1", { variantId: "var-1", type: "OUT", quantity: 6 }, "user-1");

    expect(repo.createAlert).not.toHaveBeenCalled();
    expect(repo.resolveAlert).not.toHaveBeenCalled();
  });

  it("resolve o alerta quando a reposição volta acima do mínimo", async () => {
    repo = makeRepo({
      findVariant: vi.fn().mockResolvedValue(variant({ currentQuantity: 2 })),
      findOpenAlert: vi.fn().mockResolvedValue({ id: "alert-9" }),
    });
    const service = createInventoryService(repo, events);

    await service.registerMovement("gym-1", { variantId: "var-1", type: "IN", quantity: 10 }, "user-1");

    expect(repo.resolveAlert).toHaveBeenCalledWith("alert-9");
    expect(events.publish).toHaveBeenCalledWith("gym-1", "stock.alert.resolved", {
      variantId: "var-1",
      type: "LOW_STOCK",
    });
  });

  it("publica sinal de movimentação", async () => {
    const service = createInventoryService(repo, events);

    await service.registerMovement("gym-1", { variantId: "var-1", type: "IN", quantity: 1 }, "user-1");

    expect(events.publish).toHaveBeenCalledWith("gym-1", "stock.movement.created", { variantId: "var-1" });
  });

  it("falha de alerta/notificação não derruba a movimentação já gravada", async () => {
    repo = makeRepo({ createAlert: vi.fn().mockRejectedValue(new Error("db caiu")) });
    const service = createInventoryService(repo, events);

    await expect(
      service.registerMovement("gym-1", { variantId: "var-1", type: "OUT", quantity: 6 }, "user-1"),
    ).resolves.toMatchObject({ id: "mov-1" });
  });
});

describe("resolveAlert", () => {
  it("recusa alerta de outra academia", async () => {
    const repo = makeRepo({ findAlert: vi.fn().mockResolvedValue(null) });
    const service = createInventoryService(repo, makeEvents());

    await expect(service.resolveAlert("gym-1", "alert-x")).rejects.toThrow(/não encontrado/i);
  });

  it("resolve e publica o sinal", async () => {
    const repo = makeRepo();
    const events = makeEvents();
    const service = createInventoryService(repo, events);

    await service.resolveAlert("gym-1", "alert-1");

    expect(repo.resolveAlert).toHaveBeenCalledWith("alert-1");
    expect(events.publish).toHaveBeenCalledWith("gym-1", "stock.alert.resolved", { alertId: "alert-1" });
  });
});

describe("evaluateLowStock (reutilizado por vendas e pedidos)", () => {
  it("abre alerta a partir de um snapshot pós-venda", async () => {
    const repo = makeRepo();
    const events = makeEvents();
    const service = createInventoryService(repo, events);

    await service.evaluateLowStock({
      id: "var-1",
      gymId: "gym-1",
      sku: "SKU-1",
      minQuantity: 3,
      currentQuantity: 1,
    });

    expect(repo.createAlert).toHaveBeenCalledWith({
      variantId: "var-1",
      type: "LOW_STOCK",
      message: "Estoque baixo: SKU-1 (1/3)",
    });
  });
});

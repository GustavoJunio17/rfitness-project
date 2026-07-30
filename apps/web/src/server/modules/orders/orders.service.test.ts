import { describe, expect, it, vi } from "vitest";
import { createOrdersService } from "./orders.service";
import type { OrderRecord, OrdersRepository, OrdersSideEffects } from "./orders.ports";

const variants = [
  { id: "a", sku: "SKU-A", salePrice: 100, currentQuantity: 10 },
  { id: "b", sku: "SKU-B", salePrice: 25, currentQuantity: 1 },
];

const order = (overrides: Partial<OrderRecord> = {}): OrderRecord => ({
  id: "order-1",
  orderNumber: 7,
  status: "PENDING",
  customerName: "Ana",
  customerPhone: "5531999990000",
  address: null,
  deliveryType: "PICKUP",
  paymentMethod: "PIX",
  totalAmount: 100,
  notes: null,
  studentId: null,
  createdAt: new Date("2026-07-29T10:00:00.000Z"),
  updatedAt: new Date("2026-07-29T10:00:00.000Z"),
  items: [{ variantId: "a", sku: "SKU-A", productName: "Whey", quantity: 1, unitPrice: 100 }],
  statusHistory: [],
  ...overrides,
});

function makeRepo(overrides: Partial<OrdersRepository> = {}): OrdersRepository {
  return {
    findOrderableVariants: vi.fn().mockResolvedValue(variants),
    create: vi.fn().mockResolvedValue(order()),
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(order()),
    countOpen: vi.fn().mockResolvedValue(3),
    updateStatus: vi.fn().mockImplementation(async (_gymId, _id, status) => order({ status })),
    deliverWithStockDeduction: vi.fn().mockResolvedValue({
      order: order({ status: "DELIVERED" }),
      affectedVariants: [{ id: "a", gymId: "gym-1", sku: "SKU-A", minQuantity: 2, currentQuantity: 9 }],
    }),
    ...overrides,
  };
}

function makeSideEffects(overrides: Partial<OrdersSideEffects> = {}): OrdersSideEffects {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn().mockResolvedValue(undefined),
    evaluateLowStock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createOrder", () => {
  it("persiste o pedido com total e linhas do core", async () => {
    const repo = makeRepo();
    const service = createOrdersService(repo, makeSideEffects());

    await service.createOrder("gym-1", {
      customerName: "Ana",
      customerPhone: "5531999990000",
      deliveryType: "PICKUP",
      paymentMethod: "PIX",
      items: [
        { variantId: "a", quantity: 1 },
        { variantId: "a", quantity: 1 },
      ],
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gymId: "gym-1",
        totalAmount: 200,
        lines: [{ variantId: "a", quantity: 2, unitPrice: 100 }],
      }),
    );
  });

  it("exige endereço quando é entrega", async () => {
    const repo = makeRepo();
    const service = createOrdersService(repo, makeSideEffects());

    await expect(
      service.createOrder("gym-1", {
        customerName: "Ana",
        customerPhone: "5531999990000",
        deliveryType: "DELIVERY",
        paymentMethod: "PIX",
        items: [{ variantId: "a", quantity: 1 }],
      }),
    ).rejects.toThrow(/endereço/i);

    expect(repo.create).not.toHaveBeenCalled();
  });

  it("recusa pedido acima do estoque disponível", async () => {
    const service = createOrdersService(makeRepo(), makeSideEffects());

    await expect(
      service.createOrder("gym-1", {
        customerName: "Ana",
        customerPhone: "5531999990000",
        deliveryType: "PICKUP",
        paymentMethod: "PIX",
        items: [{ variantId: "b", quantity: 2 }],
      }),
    ).rejects.toThrow(/Estoque insuficiente para o SKU SKU-B/);
  });

  it("notifica e publica sinal de pedido novo", async () => {
    const sideEffects = makeSideEffects();
    const service = createOrdersService(makeRepo(), sideEffects);

    await service.createOrder("gym-1", {
      customerName: "Ana",
      customerPhone: "5531999990000",
      deliveryType: "PICKUP",
      paymentMethod: "PIX",
      items: [{ variantId: "a", quantity: 1 }],
    });

    expect(sideEffects.publish).toHaveBeenCalledWith("gym-1", "order.created", { orderId: "order-1" });
    expect(sideEffects.notify).toHaveBeenCalledWith(
      "gym-1",
      "NEW_ORDER",
      "Novo pedido",
      "Pedido #7 recebido.",
    );
  });

  it("criar pedido não baixa estoque — a baixa é na entrega", async () => {
    const repo = makeRepo();
    const service = createOrdersService(repo, makeSideEffects());

    await service.createOrder("gym-1", {
      customerName: "Ana",
      customerPhone: "5531999990000",
      deliveryType: "PICKUP",
      paymentMethod: "PIX",
      items: [{ variantId: "a", quantity: 1 }],
    });

    expect(repo.deliverWithStockDeduction).not.toHaveBeenCalled();
  });
});

describe("updateStatus", () => {
  it("avança PENDING -> SEPARATING", async () => {
    const repo = makeRepo();
    const service = createOrdersService(repo, makeSideEffects());

    const updated = await service.updateStatus("gym-1", "order-1", "SEPARATING", "user-1");

    expect(repo.updateStatus).toHaveBeenCalledWith("gym-1", "order-1", "SEPARATING", "user-1");
    expect(updated.status).toBe("SEPARATING");
  });

  it("recusa salto de etapa", async () => {
    const repo = makeRepo();
    const service = createOrdersService(repo, makeSideEffects());

    await expect(service.updateStatus("gym-1", "order-1", "DELIVERED", "user-1")).rejects.toThrow(
      /PENDING.*DELIVERED/,
    );
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("recusa mudança em pedido já entregue", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(order({ status: "DELIVERED" })) });
    const service = createOrdersService(repo, makeSideEffects());

    await expect(service.updateStatus("gym-1", "order-1", "CANCELLED", "user-1")).rejects.toThrow(
      /DELIVERED.*CANCELLED/,
    );
  });

  it("entrega baixa o estoque numa única transação e reavalia alerta", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(order({ status: "OUT_FOR_DELIVERY" })) });
    const sideEffects = makeSideEffects();
    const service = createOrdersService(repo, sideEffects);

    const updated = await service.updateStatus("gym-1", "order-1", "DELIVERED", "user-1");

    expect(repo.deliverWithStockDeduction).toHaveBeenCalledWith("gym-1", "order-1", "user-1");
    expect(repo.updateStatus).not.toHaveBeenCalled();
    expect(updated.status).toBe("DELIVERED");
    expect(sideEffects.evaluateLowStock).toHaveBeenCalledWith({
      id: "a",
      gymId: "gym-1",
      sku: "SKU-A",
      minQuantity: 2,
      currentQuantity: 9,
    });
  });

  it("cancelamento não mexe em estoque", async () => {
    const repo = makeRepo();
    const service = createOrdersService(repo, makeSideEffects());

    await service.updateStatus("gym-1", "order-1", "CANCELLED", "user-1");

    expect(repo.deliverWithStockDeduction).not.toHaveBeenCalled();
  });

  it("publica sinal de mudança de status", async () => {
    const sideEffects = makeSideEffects();
    const service = createOrdersService(makeRepo(), sideEffects);

    await service.updateStatus("gym-1", "order-1", "SEPARATING", "user-1");

    expect(sideEffects.publish).toHaveBeenCalledWith("gym-1", "order.status_changed", {
      orderId: "order-1",
      status: "SEPARATING",
    });
  });

  it("404 para pedido de outra academia", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = createOrdersService(repo, makeSideEffects());

    await expect(service.updateStatus("gym-1", "order-x", "SEPARATING", "user-1")).rejects.toThrow(
      /não encontrado/i,
    );
  });
});

describe("consultas", () => {
  it("conta pedidos abertos", async () => {
    const service = createOrdersService(makeRepo(), makeSideEffects());
    await expect(service.getOpenCount("gym-1")).resolves.toBe(3);
  });

  it("expõe as próximas transições possíveis no detalhe", async () => {
    const service = createOrdersService(makeRepo(), makeSideEffects());
    const detail = await service.getOrder("gym-1", "order-1");
    expect(detail.allowedNextStatuses).toEqual(["SEPARATING", "CANCELLED"]);
  });
});

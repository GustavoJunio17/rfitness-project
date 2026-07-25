import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@rfitness/database";
import { OrdersService } from "./orders.service";
import type { InventoryService } from "../../../inventory/application/services/inventory.service";
import type { RealtimeService } from "../../../../shared/realtime/realtime.service";
import type { NotificationsService } from "../../../notifications/application/services/notifications.service";
import type { Order, OrderDetail, OrderRepository, OrderableVariant } from "../../domain/repositories/order.repository";

function buildVariant(overrides: Partial<OrderableVariant> = {}): OrderableVariant {
  return { id: "variant-1", sku: "WHEY-CHOCO-ABC123", salePrice: "90.00", currentQuantity: 20, ...overrides };
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    gymId: "gym-1",
    orderNumber: 1,
    studentId: null,
    customerName: "João",
    customerPhone: "5511999990000",
    address: null,
    deliveryType: "PICKUP",
    paymentMethod: "CASH",
    status: OrderStatus.PENDING,
    totalAmount: "180.00",
    notes: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildOrderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    ...buildOrder(),
    items: [{ id: "item-1", variantId: "variant-1", sku: "WHEY-CHOCO-ABC123", quantity: 2, unitPrice: "90.00" }],
    statusHistory: [{ id: "hist-1", status: OrderStatus.PENDING, changedAt: new Date(), changedBy: null }],
    ...overrides,
  };
}

describe("OrdersService", () => {
  let orders: jest.Mocked<OrderRepository>;
  let inventoryService: jest.Mocked<InventoryService>;
  let realtimeService: jest.Mocked<RealtimeService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let service: OrdersService;

  beforeEach(() => {
    orders = {
      findOrderableVariants: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      countOpen: jest.fn(),
    };
    inventoryService = { registerMovement: jest.fn() } as unknown as jest.Mocked<InventoryService>;
    realtimeService = { emitToGym: jest.fn() } as unknown as jest.Mocked<RealtimeService>;
    notificationsService = { create: jest.fn() } as unknown as jest.Mocked<NotificationsService>;

    service = new OrdersService(orders, inventoryService, realtimeService, notificationsService);
  });

  describe("createOrder", () => {
    it("computes the total amount from variant prices and quantities", async () => {
      orders.findOrderableVariants.mockResolvedValue([buildVariant()]);
      orders.create.mockResolvedValue(buildOrder());

      await service.createOrder("gym-1", {
        customerName: "João",
        customerPhone: "5511999990000",
        deliveryType: "PICKUP",
        paymentMethod: "CASH",
        items: [{ variantId: "variant-1", quantity: 2 }],
      });

      expect(orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalAmount: 180,
          lines: [expect.objectContaining({ variantId: "variant-1", quantity: 2, unitPrice: 90 })],
        }),
      );
    });

    it("merges duplicate variantIds into a single line before checking stock", async () => {
      orders.findOrderableVariants.mockResolvedValue([buildVariant({ currentQuantity: 5 })]);
      orders.create.mockResolvedValue(buildOrder());

      await service.createOrder("gym-1", {
        customerName: "João",
        customerPhone: "5511999990000",
        deliveryType: "PICKUP",
        paymentMethod: "CASH",
        items: [
          { variantId: "variant-1", quantity: 2 },
          { variantId: "variant-1", quantity: 3 },
        ],
      });

      expect(orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [expect.objectContaining({ variantId: "variant-1", quantity: 5 })],
        }),
      );
    });

    it("rejects when requested quantity exceeds current stock", async () => {
      orders.findOrderableVariants.mockResolvedValue([buildVariant({ currentQuantity: 1 })]);

      await expect(
        service.createOrder("gym-1", {
          customerName: "João",
          customerPhone: "5511999990000",
          deliveryType: "PICKUP",
          paymentMethod: "CASH",
          items: [{ variantId: "variant-1", quantity: 5 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(orders.create).not.toHaveBeenCalled();
    });

    it("rejects when a SKU does not belong to the gym", async () => {
      orders.findOrderableVariants.mockResolvedValue([]);

      await expect(
        service.createOrder("gym-1", {
          customerName: "João",
          customerPhone: "5511999990000",
          deliveryType: "PICKUP",
          paymentMethod: "CASH",
          items: [{ variantId: "ghost", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("creates a NEW_ORDER notification and emits realtime after creation", async () => {
      orders.findOrderableVariants.mockResolvedValue([buildVariant()]);
      orders.create.mockResolvedValue(buildOrder({ orderNumber: 7 }));

      await service.createOrder("gym-1", {
        customerName: "João",
        customerPhone: "5511999990000",
        deliveryType: "PICKUP",
        paymentMethod: "CASH",
        items: [{ variantId: "variant-1", quantity: 1 }],
      });

      expect(realtimeService.emitToGym).toHaveBeenCalledWith("gym-1", "order.created", { orderId: "order-1" });
      expect(notificationsService.create).toHaveBeenCalledWith(
        "gym-1",
        "NEW_ORDER",
        "Novo pedido",
        expect.stringContaining("#7"),
      );
    });
  });

  describe("getOrder", () => {
    it("throws NotFoundException when the order does not belong to the gym", async () => {
      orders.findById.mockResolvedValue(null);

      await expect(service.getOrder("gym-1", "ghost")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateStatus", () => {
    it("rejects an invalid transition", async () => {
      orders.findById.mockResolvedValue(buildOrderDetail({ status: OrderStatus.DELIVERED }));

      await expect(
        service.updateStatus("gym-1", "order-1", OrderStatus.SEPARATING, "user-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(orders.updateStatus).not.toHaveBeenCalled();
    });

    it("allows PENDING -> SEPARATING without touching stock", async () => {
      orders.findById.mockResolvedValue(buildOrderDetail({ status: OrderStatus.PENDING }));
      orders.updateStatus.mockResolvedValue(buildOrder({ status: OrderStatus.SEPARATING }));

      await service.updateStatus("gym-1", "order-1", OrderStatus.SEPARATING, "user-1");

      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
      expect(orders.updateStatus).toHaveBeenCalledWith("gym-1", "order-1", OrderStatus.SEPARATING, "user-1");
      expect(realtimeService.emitToGym).toHaveBeenCalledWith("gym-1", "order.status_changed", {
        orderId: "order-1",
        status: OrderStatus.SEPARATING,
      });
    });

    it("decrements stock for every item when transitioning to DELIVERED", async () => {
      const detail = buildOrderDetail({
        status: OrderStatus.OUT_FOR_DELIVERY,
        items: [
          { id: "item-1", variantId: "variant-1", sku: "SKU-1", quantity: 2, unitPrice: "90.00" },
          { id: "item-2", variantId: "variant-2", sku: "SKU-2", quantity: 1, unitPrice: "50.00" },
        ],
      });
      orders.findById.mockResolvedValue(detail);
      orders.findOrderableVariants.mockImplementation((_gymId, ids) =>
        Promise.resolve(
          ids.map((id) => buildVariant({ id, sku: id === "variant-1" ? "SKU-1" : "SKU-2", currentQuantity: 10 })),
        ),
      );
      orders.updateStatus.mockResolvedValue(buildOrder({ status: OrderStatus.DELIVERED }));

      await service.updateStatus("gym-1", "order-1", OrderStatus.DELIVERED, "user-1");

      expect(inventoryService.registerMovement).toHaveBeenCalledTimes(2);
      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        "gym-1",
        expect.objectContaining({ variantId: "variant-1", type: "OUT", quantity: 2 }),
        "user-1",
      );
      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        "gym-1",
        expect.objectContaining({ variantId: "variant-2", type: "OUT", quantity: 1 }),
        "user-1",
      );
    });

    it("rejects the DELIVERED transition when stock is insufficient for an item", async () => {
      const detail = buildOrderDetail({ status: OrderStatus.OUT_FOR_DELIVERY });
      orders.findById.mockResolvedValue(detail);
      orders.findOrderableVariants.mockResolvedValue([buildVariant({ currentQuantity: 0 })]);

      await expect(
        service.updateStatus("gym-1", "order-1", OrderStatus.DELIVERED, "user-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
      expect(orders.updateStatus).not.toHaveBeenCalled();
    });

    it("allows cancelling from a non-terminal state without touching stock", async () => {
      orders.findById.mockResolvedValue(buildOrderDetail({ status: OrderStatus.SEPARATING }));
      orders.updateStatus.mockResolvedValue(buildOrder({ status: OrderStatus.CANCELLED }));

      await service.updateStatus("gym-1", "order-1", OrderStatus.CANCELLED, "user-1");

      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
      expect(orders.updateStatus).toHaveBeenCalledWith("gym-1", "order-1", OrderStatus.CANCELLED, "user-1");
    });

    it("rejects any transition from a terminal state (DELIVERED)", async () => {
      orders.findById.mockResolvedValue(buildOrderDetail({ status: OrderStatus.DELIVERED }));

      await expect(
        service.updateStatus("gym-1", "order-1", OrderStatus.CANCELLED, "user-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

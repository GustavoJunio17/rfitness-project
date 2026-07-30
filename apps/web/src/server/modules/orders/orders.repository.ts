import { Prisma, type OrderStatus } from "@prisma/client";
import { applyStockDelta, computeStockDelta, notFoundError, toNumber, validationError } from "@rfitness/core";
import type { OrderableVariant } from "@rfitness/core";
import { prisma } from "../../db";
import { publishRealtime } from "../../realtime/publisher";
import { createNotification } from "../notifications/notifications.service";
import { inventoryService } from "../inventory/inventory.repository";
import { createOrdersService } from "./orders.service";
import type {
  CreateOrderPersistenceInput,
  OrderFilters,
  OrderRecord,
  OrdersRepository,
  OrdersSideEffects,
} from "./orders.ports";
import type { LowStockInput } from "../inventory/inventory.service";

const orderInclude = {
  items: { include: { variant: { select: { sku: true, product: { select: { name: true } } } } } },
  statusHistory: { orderBy: { changedAt: "asc" } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toOrderRecord(order: OrderWithRelations): OrderRecord {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: order.address,
    deliveryType: order.deliveryType,
    paymentMethod: order.paymentMethod,
    totalAmount: toNumber(order.totalAmount),
    notes: order.notes,
    studentId: order.studentId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((item) => ({
      variantId: item.variantId,
      sku: item.variant.sku,
      productName: item.variant.product.name,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
    })),
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt,
      changedBy: entry.changedBy,
    })),
  };
}

export const prismaOrdersRepository: OrdersRepository = {
  async findOrderableVariants(gymId: string, variantIds: string[]): Promise<OrderableVariant[]> {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { gymId } },
      select: { id: true, sku: true, salePrice: true, currentQuantity: true },
    });

    return variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      salePrice: toNumber(variant.salePrice),
      currentQuantity: variant.currentQuantity,
    }));
  },

  async create(input: CreateOrderPersistenceInput): Promise<OrderRecord> {
    return prisma.$transaction(async (tx) => {
      // Numeração sequencial por academia dentro da transação — dois pedidos
      // simultâneos não podem receber o mesmo número (a unique [gymId,
      // orderNumber] é a garantia final).
      const last = await tx.order.findFirst({
        where: { gymId: input.gymId },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });

      const order = await tx.order.create({
        data: {
          gymId: input.gymId,
          orderNumber: (last?.orderNumber ?? 0) + 1,
          studentId: input.studentId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          address: input.address,
          deliveryType: input.deliveryType,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          totalAmount: new Prisma.Decimal(input.totalAmount),
          items: {
            create: input.lines.map((line) => ({
              variantId: line.variantId,
              quantity: line.quantity,
              unitPrice: new Prisma.Decimal(line.unitPrice),
            })),
          },
          statusHistory: { create: { status: "PENDING", changedBy: null } },
        },
        include: orderInclude,
      });

      return toOrderRecord(order);
    });
  },

  async findMany(gymId: string, filters: OrderFilters): Promise<OrderRecord[]> {
    const orders = await prisma.order.findMany({
      where: { gymId, ...(filters.status ? { status: filters.status } : {}) },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100,
    });
    return orders.map(toOrderRecord);
  },

  async findById(gymId: string, id: string): Promise<OrderRecord | null> {
    const order = await prisma.order.findFirst({ where: { id, gymId }, include: orderInclude });
    return order ? toOrderRecord(order) : null;
  },

  countOpen(gymId: string): Promise<number> {
    return prisma.order.count({
      where: { gymId, status: { in: ["PENDING", "SEPARATING", "OUT_FOR_DELIVERY"] } },
    });
  },

  async updateStatus(
    gymId: string,
    orderId: string,
    status: OrderStatus,
    changedBy: string | null,
  ): Promise<OrderRecord> {
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status, statusHistory: { create: { status, changedBy } } },
        include: orderInclude,
      });
      if (updated.gymId !== gymId) throw notFoundError("Pedido não encontrado.");
      return updated;
    });

    return toOrderRecord(order);
  },

  async deliverWithStockDeduction(gymId: string, orderId: string, changedBy: string | null) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, gymId },
        include: { items: true },
      });
      if (!order) throw notFoundError("Pedido não encontrado.");

      const affectedVariants: LowStockInput[] = [];

      for (const item of order.items) {
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, product: { gymId } },
          select: { id: true, sku: true, minQuantity: true, currentQuantity: true },
        });
        if (!variant) throw notFoundError("SKU do pedido não encontrado nesta academia.");

        const delta = computeStockDelta("OUT", item.quantity, variant.currentQuantity);
        let resultingQuantity: number;
        try {
          resultingQuantity = applyStockDelta(variant.currentQuantity, delta);
        } catch {
          // Mensagem específica da entrega: o operador precisa saber qual SKU
          // travou a baixa. A transação inteira é desfeita — nunca há entrega
          // com baixa parcial.
          throw validationError(`Estoque insuficiente para o SKU ${variant.sku} na entrega deste pedido.`);
        }

        await tx.stockMovement.create({
          data: {
            variantId: variant.id,
            type: "OUT",
            quantity: delta,
            reason: `Pedido #${order.orderNumber}`,
            createdById: changedBy,
          },
        });
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { currentQuantity: resultingQuantity },
        });

        affectedVariants.push({
          id: variant.id,
          gymId,
          sku: variant.sku,
          minQuantity: variant.minQuantity,
          currentQuantity: resultingQuantity,
        });
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: "DELIVERED", statusHistory: { create: { status: "DELIVERED", changedBy } } },
        include: orderInclude,
      });

      return { order: toOrderRecord(updated), affectedVariants };
    });
  },
};

export const ordersSideEffects: OrdersSideEffects = {
  publish: publishRealtime,
  notify: createNotification,
  evaluateLowStock: (variant) => inventoryService.evaluateLowStock(variant),
};

export const ordersService = createOrdersService(prismaOrdersRepository, ordersSideEffects);

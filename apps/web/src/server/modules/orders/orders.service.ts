import type { DeliveryType, OrderStatus, PaymentMethodType } from "@prisma/client";
import {
  assertDeliveryAddress,
  assertOrderTransition,
  computeOrderTotals,
  mergeCartItems,
  nextOrderStatuses,
  notFoundError,
  shouldDeductStockOnTransition,
  type CartItem,
} from "@rfitness/core";
import type { OrderFilters, OrderRecord, OrdersRepository, OrdersSideEffects } from "./orders.ports";

export interface CreateOrderInput {
  studentId?: string | null;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethodType;
  notes?: string | null;
  items: CartItem[];
}

export interface OrderDetail extends OrderRecord {
  allowedNextStatuses: OrderStatus[];
}

export function createOrdersService(repository: OrdersRepository, sideEffects: OrdersSideEffects) {
  async function createOrder(gymId: string, input: CreateOrderInput): Promise<OrderRecord> {
    assertDeliveryAddress(input.deliveryType, input.address);

    const merged = mergeCartItems(input.items);
    const variants = await repository.findOrderableVariants(
      gymId,
      merged.map((item) => item.variantId),
    );
    const totals = computeOrderTotals({ items: merged, variants });

    const order = await repository.create({
      gymId,
      studentId: input.studentId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: input.address ?? null,
      deliveryType: input.deliveryType,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? null,
      totalAmount: totals.totalAmount,
      lines: totals.lines,
    });

    try {
      await sideEffects.publish(gymId, "order.created", { orderId: order.id });
      await sideEffects.notify(gymId, "NEW_ORDER", "Novo pedido", `Pedido #${order.orderNumber} recebido.`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[orders] falha ao notificar pedido ${order.id}:`, error);
    }

    return order;
  }

  function listOrders(gymId: string, filters: OrderFilters): Promise<OrderRecord[]> {
    return repository.findMany(gymId, filters);
  }

  async function getOrder(gymId: string, id: string): Promise<OrderDetail> {
    const order = await repository.findById(gymId, id);
    if (!order) throw notFoundError("Pedido não encontrado.");
    return { ...order, allowedNextStatuses: nextOrderStatuses(order.status) };
  }

  function getOpenCount(gymId: string): Promise<number> {
    return repository.countOpen(gymId);
  }

  async function updateStatus(
    gymId: string,
    orderId: string,
    status: OrderStatus,
    changedBy: string | null,
  ): Promise<OrderRecord> {
    const current = await repository.findById(gymId, orderId);
    if (!current) throw notFoundError("Pedido não encontrado.");

    assertOrderTransition(current.status, status);

    let updated: OrderRecord;

    if (shouldDeductStockOnTransition(status)) {
      const result = await repository.deliverWithStockDeduction(gymId, orderId, changedBy);
      updated = result.order;

      // Depois do commit: alerta de estoque baixo dos SKUs que saíram.
      try {
        await Promise.all(result.affectedVariants.map((variant) => sideEffects.evaluateLowStock(variant)));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[orders] falha ao reavaliar estoque após entrega de ${orderId}:`, error);
      }
    } else {
      updated = await repository.updateStatus(gymId, orderId, status, changedBy);
    }

    try {
      await sideEffects.publish(gymId, "order.status_changed", { orderId, status });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[orders] falha ao publicar mudança de status de ${orderId}:`, error);
    }

    return updated;
  }

  return { createOrder, listOrders, getOrder, getOpenCount, updateStatus };
}

export type OrdersService = ReturnType<typeof createOrdersService>;

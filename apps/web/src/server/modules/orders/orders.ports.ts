import type { DeliveryType, NotificationType, OrderStatus, PaymentMethodType } from "@prisma/client";
import type { OrderLine, OrderableVariant } from "@rfitness/core";
import type { RealtimeEventType } from "../../realtime/signal";
import type { LowStockInput } from "../inventory/inventory.service";

export interface OrderItemRecord {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderStatusHistoryRecord {
  status: OrderStatus;
  changedAt: Date;
  changedBy: string | null;
}

export interface OrderRecord {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  address: string | null;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethodType;
  totalAmount: number;
  notes: string | null;
  studentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemRecord[];
  statusHistory: OrderStatusHistoryRecord[];
}

export interface OrderFilters {
  status?: OrderStatus;
  limit?: number;
}

export interface CreateOrderPersistenceInput {
  gymId: string;
  studentId: string | null;
  customerName: string;
  customerPhone: string;
  address: string | null;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethodType;
  notes: string | null;
  totalAmount: number;
  lines: OrderLine[];
}

export interface OrdersRepository {
  findOrderableVariants(gymId: string, variantIds: string[]): Promise<OrderableVariant[]>;
  create(input: CreateOrderPersistenceInput): Promise<OrderRecord>;
  findMany(gymId: string, filters: OrderFilters): Promise<OrderRecord[]>;
  findById(gymId: string, id: string): Promise<OrderRecord | null>;
  countOpen(gymId: string): Promise<number>;
  updateStatus(
    gymId: string,
    orderId: string,
    status: OrderStatus,
    changedBy: string | null,
  ): Promise<OrderRecord>;
  /**
   * Marca como entregue **e** baixa o estoque de todos os itens na mesma
   * transação. Concentrar isso no repositório é o que impede a baixa parcial que
   * a implementação anterior (um movimento por item, cada um em sua transação)
   * permitia.
   */
  deliverWithStockDeduction(
    gymId: string,
    orderId: string,
    changedBy: string | null,
  ): Promise<{ order: OrderRecord; affectedVariants: LowStockInput[] }>;
}

export interface OrdersSideEffects {
  publish(gymId: string, type: RealtimeEventType, payload?: Record<string, unknown>): Promise<void>;
  notify(gymId: string, type: NotificationType, title: string, message: string): Promise<void>;
  evaluateLowStock(variant: LowStockInput): Promise<void>;
}

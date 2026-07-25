import type { DeliveryType, OrderStatus, PaymentMethodType } from "@rfitness/database";

export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");

export interface OrderableVariant {
  id: string;
  sku: string;
  salePrice: string;
  currentQuantity: number;
}

export interface OrderItem {
  id: string;
  variantId: string;
  sku: string;
  quantity: number;
  unitPrice: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  status: OrderStatus;
  changedAt: Date;
  changedBy: string | null;
}

export interface Order {
  id: string;
  gymId: string;
  orderNumber: number;
  studentId: string | null;
  customerName: string;
  customerPhone: string;
  address: string | null;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethodType;
  status: OrderStatus;
  totalAmount: string;
  notes: string | null;
  createdAt: Date;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface OrderLineToCreate {
  variantId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
  gymId: string;
  studentId?: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethodType;
  notes?: string;
  totalAmount: number;
  lines: OrderLineToCreate[];
}

export interface OrderFilters {
  status?: OrderStatus;
}

export interface OrderRepository {
  findOrderableVariants(gymId: string, variantIds: string[]): Promise<OrderableVariant[]>;
  create(input: CreateOrderInput): Promise<Order>;
  updateStatus(gymId: string, orderId: string, status: OrderStatus, changedBy?: string): Promise<Order>;
  findMany(gymId: string, filters: OrderFilters): Promise<Order[]>;
  findById(gymId: string, id: string): Promise<OrderDetail | null>;
  countOpen(gymId: string): Promise<number>;
}

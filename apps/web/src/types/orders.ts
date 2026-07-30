import type { PaymentMethodType } from "./sales";

export type OrderStatus = "PENDING" | "SEPARATING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export type DeliveryType = "DELIVERY" | "PICKUP";

export interface OrderItem {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  changedAt: string;
  changedBy: string | null;
}

export interface Order {
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
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface OrderDetail extends Order {
  /** Transições permitidas a partir do status atual, calculadas no servidor. */
  allowedNextStatuses: OrderStatus[];
}

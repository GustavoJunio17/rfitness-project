import type { PaymentMethodType } from "./sales";

export type OrderStatus = "PENDING" | "SEPARATING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export type DeliveryType = "DELIVERY" | "PICKUP";

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
  changedAt: string;
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
  createdAt: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

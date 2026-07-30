import { validationError } from "../shared/errors";

export const ORDER_STATUSES = [
  "PENDING",
  "SEPARATING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["SEPARATING", "CANCELLED"],
  SEPARATING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function nextOrderStatuses(current: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[current]];
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw validationError(`Não é possível mudar o pedido de ${from} para ${to}.`);
  }
}

/** A baixa de estoque do pedido acontece exatamente na entrada em DELIVERED. */
export function shouldDeductStockOnTransition(to: OrderStatus): boolean {
  return to === "DELIVERED";
}

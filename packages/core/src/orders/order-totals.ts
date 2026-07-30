import { notFoundError, validationError } from "../shared/errors";
import { multiplyMoney, sumMoney } from "../shared/money";
import { mergeCartItems, type CartItem } from "../sales/sale-totals";

export const DELIVERY_TYPES = ["DELIVERY", "PICKUP"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export interface OrderableVariant {
  id: string;
  sku: string;
  salePrice: number;
  currentQuantity: number;
}

export interface OrderLine {
  variantId: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderTotals {
  totalAmount: number;
  lines: OrderLine[];
}

/**
 * Total do pedido com snapshot do preço. Criar pedido **não** baixa estoque — a
 * reserva é lógica e a baixa acontece na entrega —, mas a disponibilidade é
 * validada aqui para não aceitar pedido impossível.
 */
export function computeOrderTotals(input: {
  items: CartItem[];
  variants: OrderableVariant[];
}): OrderTotals {
  const merged = mergeCartItems(input.items);
  const variantById = new Map(input.variants.map((variant) => [variant.id, variant]));

  const lines: OrderLine[] = [];
  let totalAmount = 0;

  for (const item of merged) {
    const variant = variantById.get(item.variantId);
    if (!variant) {
      throw notFoundError("Um ou mais SKUs não foram encontrados nesta academia.");
    }
    if (variant.currentQuantity < item.quantity) {
      throw validationError(`Estoque insuficiente para o SKU ${variant.sku}.`);
    }

    totalAmount = sumMoney(totalAmount, multiplyMoney(variant.salePrice, item.quantity));
    lines.push({ variantId: variant.id, quantity: item.quantity, unitPrice: variant.salePrice });
  }

  return { totalAmount, lines };
}

export function assertDeliveryAddress(deliveryType: DeliveryType, address: string | null | undefined): void {
  if (deliveryType === "DELIVERY" && !address?.trim()) {
    throw validationError("Endereço é obrigatório para pedidos com entrega.");
  }
}

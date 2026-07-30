import { notFoundError, validationError } from "../shared/errors";
import { multiplyMoney, round2, sumMoney } from "../shared/money";

export interface CartItem {
  variantId: string;
  quantity: number;
}

export interface SellableVariant {
  id: string;
  sku: string;
  salePrice: number;
  costPrice: number;
  currentQuantity: number;
  minQuantity: number;
}

export interface SaleLine {
  variantId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  /** Estoque do SKU depois desta venda — usado para reavaliar estoque baixo. */
  resultingQuantity: number;
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  totalAmount: number;
  totalProfit: number;
  lines: SaleLine[];
}

/**
 * Funde linhas do mesmo SKU. Sem isso, duas linhas do mesmo SKU seriam validadas
 * contra o mesmo `currentQuantity` pré-venda e a baixa sairia subcontada.
 */
export function mergeCartItems(items: CartItem[]): CartItem[] {
  if (items.length === 0) throw validationError("A venda precisa de pelo menos um item.");

  const merged = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity)) {
      throw validationError("A quantidade do item deve ser inteira.");
    }
    if (item.quantity <= 0) {
      throw validationError("A quantidade do item deve ser positiva.");
    }
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
  }

  return [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Calcula a venda inteira sem tocar em banco: preço e custo viram snapshot na
 * linha (histórico não muda se o preço do SKU mudar depois) e o desconto sai
 * integralmente da margem.
 */
export function computeSaleTotals(input: {
  items: CartItem[];
  variants: SellableVariant[];
  discount?: number;
}): SaleTotals {
  const discount = input.discount ?? 0;
  if (discount < 0) throw validationError("O desconto não pode ser negativo.");

  const merged = mergeCartItems(input.items);
  const variantById = new Map(input.variants.map((variant) => [variant.id, variant]));

  const lines: SaleLine[] = [];
  let subtotal = 0;
  let profitBeforeDiscount = 0;

  for (const item of merged) {
    const variant = variantById.get(item.variantId);
    if (!variant) {
      throw notFoundError("Um ou mais SKUs não foram encontrados nesta academia.");
    }
    if (variant.currentQuantity < item.quantity) {
      throw validationError(`Estoque insuficiente para o SKU ${variant.sku}.`);
    }

    subtotal = sumMoney(subtotal, multiplyMoney(variant.salePrice, item.quantity));
    profitBeforeDiscount = sumMoney(
      profitBeforeDiscount,
      multiplyMoney(round2(variant.salePrice - variant.costPrice), item.quantity),
    );

    lines.push({
      variantId: variant.id,
      quantity: item.quantity,
      unitPrice: variant.salePrice,
      unitCost: variant.costPrice,
      resultingQuantity: variant.currentQuantity - item.quantity,
    });
  }

  if (discount > subtotal) {
    throw validationError("O desconto não pode ser maior que o subtotal da venda.");
  }

  return {
    subtotal,
    discount: round2(discount),
    totalAmount: round2(subtotal - discount),
    totalProfit: round2(profitBeforeDiscount - discount),
    lines,
  };
}

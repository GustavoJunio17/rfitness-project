import { validationError } from "../shared/errors";

export const STOCK_MOVEMENT_TYPES = [
  "IN",
  "OUT",
  "SALE",
  "EXCHANGE",
  "LOSS",
  "EXPIRATION",
  "INVENTORY_ADJUSTMENT",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/**
 * Converte o input do usuário no delta real aplicado a `currentQuantity`.
 * O valor devolvido é o que vai gravado em `StockMovement.quantity` — nunca o
 * input cru — para que somar os movimentos de um SKU reconstitua o estoque.
 *
 * IN/EXCHANGE somam, OUT/SALE/LOSS/EXPIRATION subtraem, e em
 * INVENTORY_ADJUSTMENT o input é a contagem física nova (delta = contado - atual).
 */
export function computeStockDelta(
  type: StockMovementType,
  quantity: number,
  currentQuantity: number,
): number {
  if (!Number.isInteger(quantity)) {
    throw validationError("A quantidade da movimentação deve ser inteira.");
  }

  switch (type) {
    case "IN":
      if (quantity <= 0) throw validationError("Quantidade deve ser positiva para entrada.");
      return quantity;

    case "EXCHANGE":
      if (quantity === 0) throw validationError("Quantidade da troca não pode ser zero.");
      return quantity;

    case "OUT":
    case "SALE":
    case "LOSS":
    case "EXPIRATION":
      if (quantity <= 0) throw validationError("Quantidade deve ser positiva.");
      return -quantity;

    case "INVENTORY_ADJUSTMENT":
      if (quantity < 0) throw validationError("A contagem de inventário não pode ser negativa.");
      return quantity - currentQuantity;

    default: {
      const exhaustive: never = type;
      throw validationError(`Tipo de movimentação inválido: ${String(exhaustive)}`);
    }
  }
}

/** Estoque resultante, recusando saldo negativo. */
export function applyStockDelta(currentQuantity: number, delta: number): number {
  const resulting = currentQuantity + delta;
  if (resulting < 0) {
    throw validationError("Quantidade insuficiente em estoque para esta movimentação.");
  }
  return resulting;
}

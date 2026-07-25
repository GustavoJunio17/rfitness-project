import type { StockMovementType } from "@rfitness/database";

export const STOCK_MOVEMENT_REPOSITORY = Symbol("STOCK_MOVEMENT_REPOSITORY");

export interface StockMovement {
  id: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  createdById: string | null;
  createdAt: Date;
}

export interface CreateStockMovementInput {
  variantId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  createdById?: string;
}

export interface StockMovementFilters {
  variantId?: string;
  type?: StockMovementType;
}

export interface StockMovementRepository {
  /**
   * Records the movement and applies the resulting quantity to the variant in a
   * single DB transaction — the two writes must never diverge, since the movement
   * log is the audit trail for how `currentQuantity` got to its current value.
   */
  createAndApplyQuantity(input: CreateStockMovementInput, resultingQuantity: number): Promise<StockMovement>;
  findMany(gymId: string, filters: StockMovementFilters): Promise<StockMovement[]>;
  countByTypesSince(variantId: string, types: StockMovementType[], since: Date): Promise<number>;
}

export const STOCK_VARIANT_REPOSITORY = Symbol("STOCK_VARIANT_REPOSITORY");

export interface StockVariantSnapshot {
  id: string;
  gymId: string;
  sku: string;
  minQuantity: number;
  maxQuantity: number | null;
  currentQuantity: number;
  expiresAt: Date | null;
}

export interface StockVariantRepository {
  findById(gymId: string, variantId: string): Promise<StockVariantSnapshot | null>;
  /** Cross-tenant listing used only by the daily alert scheduler (a system job, not a request handler). */
  listAllWithStock(): Promise<StockVariantSnapshot[]>;
}

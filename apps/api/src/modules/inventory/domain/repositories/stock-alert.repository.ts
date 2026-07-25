import type { StockAlertType } from "@rfitness/database";

export const STOCK_ALERT_REPOSITORY = Symbol("STOCK_ALERT_REPOSITORY");

export interface StockAlert {
  id: string;
  variantId: string;
  type: StockAlertType;
  message: string;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface CreateStockAlertInput {
  variantId: string;
  type: StockAlertType;
  message: string;
}

export interface StockAlertFilters {
  resolved?: boolean;
}

export interface StockAlertRepository {
  findOpenByVariantAndType(variantId: string, type: StockAlertType): Promise<StockAlert | null>;
  create(input: CreateStockAlertInput): Promise<StockAlert>;
  resolve(id: string): Promise<void>;
  findMany(gymId: string, filters: StockAlertFilters): Promise<StockAlert[]>;
  findById(gymId: string, id: string): Promise<StockAlert | null>;
}

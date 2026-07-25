import type { PaymentMethodType } from "@rfitness/database";

export const SALE_REPOSITORY = Symbol("SALE_REPOSITORY");

export interface SellableVariant {
  id: string;
  sku: string;
  minQuantity: number;
  currentQuantity: number;
  costPrice: string;
  salePrice: string;
}

export interface SaleItem {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: string;
  unitCost: string;
}

export interface Sale {
  id: string;
  gymId: string;
  studentId: string | null;
  employeeId: string;
  paymentMethod: PaymentMethodType;
  discount: string;
  totalAmount: string;
  totalProfit: string;
  createdAt: Date;
  items: SaleItem[];
}

export interface SaleLineToCreate {
  variantId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  resultingQuantity: number;
}

export interface CreateSaleInput {
  gymId: string;
  studentId?: string;
  employeeId: string;
  paymentMethod: PaymentMethodType;
  discount: number;
  totalAmount: number;
  totalProfit: number;
  lines: SaleLineToCreate[];
}

export interface SaleFilters {
  employeeId?: string;
  from?: Date;
  to?: Date;
}

export interface SaleRepository {
  findSellableVariants(gymId: string, variantIds: string[]): Promise<SellableVariant[]>;
  create(input: CreateSaleInput): Promise<Sale>;
  findMany(gymId: string, filters: SaleFilters): Promise<Sale[]>;
  findById(gymId: string, id: string): Promise<Sale | null>;
}

import type { PaymentMethodType } from "@prisma/client";
import type { SaleLine, SellableVariant } from "@rfitness/core";
import type { RealtimeEventType } from "../../realtime/signal";
import type { LowStockInput } from "../inventory/inventory.service";

export interface SaleItemRecord {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface SaleRecord {
  id: string;
  totalAmount: number;
  totalProfit: number;
  discount: number;
  paymentMethod: PaymentMethodType;
  studentName: string | null;
  employeeName: string;
  createdAt: Date;
  items: SaleItemRecord[];
}

export interface SaleFilters {
  employeeId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface CreateSalePersistenceInput {
  gymId: string;
  employeeId: string;
  studentId: string | null;
  paymentMethod: PaymentMethodType;
  discount: number;
  totalAmount: number;
  totalProfit: number;
  lines: SaleLine[];
}

export interface SalesRepository {
  findSellableVariants(gymId: string, variantIds: string[]): Promise<SellableVariant[]>;
  /** Cria venda + itens + movimentos SALE + baixa de estoque em uma transação. */
  create(input: CreateSalePersistenceInput): Promise<SaleRecord>;
  findMany(gymId: string, filters: SaleFilters): Promise<SaleRecord[]>;
  findById(gymId: string, id: string): Promise<SaleRecord | null>;
}

export interface SalesSideEffects {
  evaluateLowStock(variant: LowStockInput): Promise<void>;
  registerSaleRevenue(gymId: string, saleId: string, amount: number): Promise<void>;
  publish(gymId: string, type: RealtimeEventType, payload?: Record<string, unknown>): Promise<void>;
}

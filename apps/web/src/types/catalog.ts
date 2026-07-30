export interface Category {
  id: string;
  name: string;
  productCount?: number;
}

export interface Brand {
  id: string;
  name: string;
  productCount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  productCount?: number;
}

export type ProductStatus = "ACTIVE" | "INACTIVE" | "DISCONTINUED";

export interface ProductVariant {
  id: string;
  sku: string;
  brandId: string | null;
  brandName: string | null;
  flavor: string | null;
  weight: string | null;
  barcode: string | null;
  photoUrl: string | null;
  location: string | null;
  batch: string | null;
  expiresAt: string | null;
  costPrice: number;
  salePrice: number;
  minQuantity: number;
  maxQuantity: number | null;
  currentQuantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  categoryId: string | null;
  categoryName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  variants: ProductVariant[];
}

export interface VariantByBarcode extends ProductVariant {
  productId: string;
  productName: string;
}

export type StockMovementType =
  | "IN"
  | "OUT"
  | "SALE"
  | "EXCHANGE"
  | "LOSS"
  | "EXPIRATION"
  | "INVENTORY_ADJUSTMENT";

export interface StockMovement {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  type: StockMovementType;
  /** Delta aplicado ao estoque (negativo em saídas). */
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export type StockAlertType = "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED" | "STALE";

export interface StockAlert {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  type: StockAlertType;
  message: string;
  resolvedAt: string | null;
  createdAt: string;
}

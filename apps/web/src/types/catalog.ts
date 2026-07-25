export interface Category {
  id: string;
  gymId: string;
  name: string;
}

export interface Brand {
  id: string;
  gymId: string;
  name: string;
}

export interface Supplier {
  id: string;
  gymId: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export type ProductStatus = "ACTIVE" | "INACTIVE" | "DISCONTINUED";

export interface ProductVariant {
  id: string;
  productId: string;
  brandId: string | null;
  sku: string;
  flavor: string | null;
  weight: string | null;
  barcode: string | null;
  photoUrl: string | null;
  location: string | null;
  batch: string | null;
  expiresAt: string | null;
  costPrice: string;
  salePrice: string;
  minQuantity: number;
  maxQuantity: number | null;
  currentQuantity: number;
}

export interface Product {
  id: string;
  gymId: string;
  categoryId: string | null;
  supplierId: string | null;
  name: string;
  description: string | null;
  status: ProductStatus;
  variants: ProductVariant[];
}

export type StockMovementType =
  | "IN"
  | "OUT"
  | "SALE"
  | "EXCHANGE"
  | "LOSS"
  | "EXPIRATION"
  | "INVENTORY_ADJUSTMENT";

export type StockAlertType = "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED" | "STALE";

export interface StockAlert {
  id: string;
  variantId: string;
  type: StockAlertType;
  message: string;
  resolvedAt: string | null;
  createdAt: string;
}

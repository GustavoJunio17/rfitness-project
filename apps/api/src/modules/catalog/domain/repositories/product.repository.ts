export const PRODUCT_REPOSITORY = Symbol("PRODUCT_REPOSITORY");

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
  expiresAt: Date | null;
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

export interface ProductVariantInput {
  brandId?: string;
  flavor?: string;
  weight?: string;
  barcode?: string;
  location?: string;
  batch?: string;
  expiresAt?: Date;
  costPrice: number;
  salePrice: number;
  minQuantity: number;
  maxQuantity?: number;
  initialQuantity?: number;
}

export interface ProductInput {
  name: string;
  description?: string;
  categoryId?: string;
  supplierId?: string;
  status?: ProductStatus;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
}

export interface ProductRepository {
  create(gymId: string, input: ProductInput, variants: (ProductVariantInput & { sku: string })[]): Promise<Product>;
  findAll(gymId: string, filters: ProductFilters): Promise<Product[]>;
  findById(gymId: string, id: string): Promise<Product | null>;
  update(gymId: string, id: string, input: Partial<ProductInput>): Promise<Product>;
  delete(gymId: string, id: string): Promise<void>;

  addVariant(gymId: string, productId: string, input: ProductVariantInput & { sku: string }): Promise<ProductVariant>;
  updateVariant(gymId: string, variantId: string, input: Partial<ProductVariantInput>): Promise<ProductVariant>;
  setVariantPhoto(gymId: string, variantId: string, photoUrl: string): Promise<void>;
  findVariantById(gymId: string, variantId: string): Promise<ProductVariant | null>;
  findVariantByBarcode(gymId: string, barcode: string): Promise<ProductVariant | null>;
  skuExists(sku: string): Promise<boolean>;
}

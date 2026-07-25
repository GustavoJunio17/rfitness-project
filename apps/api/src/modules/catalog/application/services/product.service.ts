import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import * as QRCode from "qrcode";
import {
  PRODUCT_REPOSITORY,
  Product,
  ProductFilters,
  ProductInput,
  ProductRepository,
  ProductVariant,
  ProductVariantInput,
} from "../../domain/repositories/product.repository";
import { STORAGE_REPOSITORY, StorageRepository } from "../../../../shared/storage/storage.repository";
import { BRAND_REPOSITORY, BrandRepository } from "../../domain/repositories/brand.repository";
import { generateSku } from "../utils/sku.util";

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(STORAGE_REPOSITORY) private readonly storage: StorageRepository,
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository,
  ) {}

  async createProduct(gymId: string, input: ProductInput, variants: ProductVariantInput[]): Promise<Product> {
    const brandNamesById = await this.resolveBrandNames(gymId, variants);
    const variantsWithSku = await Promise.all(
      variants.map(async (variant) => ({
        ...variant,
        sku: await this.generateUniqueSku(input.name, variant, brandNamesById),
      })),
    );
    return this.products.create(gymId, input, variantsWithSku);
  }

  listProducts(gymId: string, filters: ProductFilters): Promise<Product[]> {
    return this.products.findAll(gymId, filters);
  }

  async getProduct(gymId: string, id: string): Promise<Product> {
    const product = await this.products.findById(gymId, id);
    if (!product) throw new NotFoundException("Produto não encontrado.");
    return product;
  }

  updateProduct(gymId: string, id: string, input: Partial<ProductInput>): Promise<Product> {
    return this.products.update(gymId, id, input);
  }

  deleteProduct(gymId: string, id: string): Promise<void> {
    return this.products.delete(gymId, id);
  }

  async addVariant(gymId: string, productId: string, input: ProductVariantInput): Promise<ProductVariant> {
    const product = await this.getProduct(gymId, productId);
    const brandNamesById = await this.resolveBrandNames(gymId, [input]);
    const sku = await this.generateUniqueSku(product.name, input, brandNamesById);
    return this.products.addVariant(gymId, productId, { ...input, sku });
  }

  updateVariant(gymId: string, variantId: string, input: Partial<ProductVariantInput>): Promise<ProductVariant> {
    return this.products.updateVariant(gymId, variantId, input);
  }

  async findVariantByBarcode(gymId: string, barcode: string): Promise<ProductVariant> {
    const variant = await this.products.findVariantByBarcode(gymId, barcode);
    if (!variant) throw new NotFoundException("Nenhum SKU encontrado para este código de barras.");
    return variant;
  }

  async generateVariantQrCode(gymId: string, variantId: string): Promise<{ sku: string; dataUrl: string }> {
    const variant = await this.products.findVariantById(gymId, variantId);
    if (!variant) throw new NotFoundException("SKU não encontrado.");
    const dataUrl = await QRCode.toDataURL(variant.sku, { margin: 1, width: 256 });
    return { sku: variant.sku, dataUrl };
  }

  async uploadVariantPhoto(
    gymId: string,
    variantId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ photoUrl: string }> {
    const variant = await this.products.findVariantById(gymId, variantId);
    if (!variant) throw new NotFoundException("SKU não encontrado.");

    const { url } = await this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: "products",
    });
    await this.products.setVariantPhoto(gymId, variantId, url);
    return { photoUrl: url };
  }

  private async resolveBrandNames(
    gymId: string,
    variants: Pick<ProductVariantInput, "brandId">[],
  ): Promise<Map<string, string>> {
    const brandIds = [...new Set(variants.map((v) => v.brandId).filter((id): id is string => Boolean(id)))];
    const brands = await Promise.all(brandIds.map((id) => this.brands.findById(gymId, id)));
    return new Map(brands.filter((b): b is NonNullable<typeof b> => Boolean(b)).map((b) => [b.id, b.name]));
  }

  private async generateUniqueSku(
    productName: string,
    variant: Pick<ProductVariantInput, "brandId" | "flavor" | "weight">,
    brandNamesById: Map<string, string>,
  ): Promise<string> {
    const brandName = variant.brandId ? brandNamesById.get(variant.brandId) : undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sku = generateSku([productName, brandName, variant.flavor, variant.weight]);
      // eslint-disable-next-line no-await-in-loop
      if (!(await this.products.skuExists(sku))) return sku;
    }
    throw new Error("Não foi possível gerar um SKU único. Tente novamente.");
  }
}

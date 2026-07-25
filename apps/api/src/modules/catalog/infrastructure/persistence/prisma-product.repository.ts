import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  Product,
  ProductFilters,
  ProductInput,
  ProductRepository,
  ProductVariant,
  ProductVariantInput,
} from "../../domain/repositories/product.repository";

type PrismaProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;
type PrismaVariant = Prisma.ProductVariantGetPayload<Record<string, never>>;

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    gymId: string,
    input: ProductInput,
    variants: (ProductVariantInput & { sku: string })[],
  ): Promise<Product> {
    const product = await this.prisma.product.create({
      data: {
        gymId,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        status: input.status ?? "ACTIVE",
        variants: {
          create: variants.map((variant) => this.toVariantCreateData(variant)),
        },
      },
      include: { variants: true },
    });
    return this.toDomain(product);
  }

  async findAll(gymId: string, filters: ProductFilters): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: {
        gymId,
        status: filters.status,
        categoryId: filters.categoryId,
        name: filters.search ? { contains: filters.search, mode: "insensitive" } : undefined,
      },
      include: { variants: true },
      orderBy: { name: "asc" },
    });
    return products.map((product) => this.toDomain(product));
  }

  async findById(gymId: string, id: string): Promise<Product | null> {
    const product = await this.prisma.product.findFirst({
      where: { id, gymId },
      include: { variants: true },
    });
    return product ? this.toDomain(product) : null;
  }

  async update(gymId: string, id: string, input: Partial<ProductInput>): Promise<Product> {
    await this.assertProductExists(gymId, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: input,
      include: { variants: true },
    });
    return this.toDomain(product);
  }

  async delete(gymId: string, id: string): Promise<void> {
    await this.assertProductExists(gymId, id);
    await this.prisma.product.delete({ where: { id } });
  }

  async addVariant(
    gymId: string,
    productId: string,
    input: ProductVariantInput & { sku: string },
  ): Promise<ProductVariant> {
    await this.assertProductExists(gymId, productId);
    const variant = await this.prisma.productVariant.create({
      data: { productId, ...this.toVariantCreateData(input) },
    });
    return this.toVariantDomain(variant);
  }

  async updateVariant(
    gymId: string,
    variantId: string,
    input: Partial<ProductVariantInput>,
  ): Promise<ProductVariant> {
    await this.assertVariantExists(gymId, variantId);
    const { initialQuantity: _initialQuantity, ...rest } = input;
    const variant = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: rest,
    });
    return this.toVariantDomain(variant);
  }

  async setVariantPhoto(gymId: string, variantId: string, photoUrl: string): Promise<void> {
    await this.assertVariantExists(gymId, variantId);
    await this.prisma.productVariant.update({ where: { id: variantId }, data: { photoUrl } });
  }

  async findVariantById(gymId: string, variantId: string): Promise<ProductVariant | null> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { gymId } },
    });
    return variant ? this.toVariantDomain(variant) : null;
  }

  async findVariantByBarcode(gymId: string, barcode: string): Promise<ProductVariant | null> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { barcode, product: { gymId } },
    });
    return variant ? this.toVariantDomain(variant) : null;
  }

  async skuExists(sku: string): Promise<boolean> {
    const variant = await this.prisma.productVariant.findUnique({ where: { sku } });
    return variant !== null;
  }

  private toVariantCreateData(input: ProductVariantInput & { sku: string }) {
    return {
      sku: input.sku,
      brandId: input.brandId,
      flavor: input.flavor,
      weight: input.weight,
      barcode: input.barcode,
      location: input.location,
      batch: input.batch,
      expiresAt: input.expiresAt,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
      currentQuantity: input.initialQuantity ?? 0,
    };
  }

  private async assertProductExists(gymId: string, id: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id, gymId } });
    if (!product) throw new NotFoundException("Produto não encontrado.");
  }

  private async assertVariantExists(gymId: string, variantId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { gymId } },
    });
    if (!variant) throw new NotFoundException("SKU não encontrado.");
  }

  private toDomain(product: PrismaProductWithVariants): Product {
    return {
      id: product.id,
      gymId: product.gymId,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      name: product.name,
      description: product.description,
      status: product.status,
      variants: product.variants.map((variant) => this.toVariantDomain(variant)),
    };
  }

  private toVariantDomain(variant: PrismaVariant): ProductVariant {
    return {
      id: variant.id,
      productId: variant.productId,
      brandId: variant.brandId,
      sku: variant.sku,
      flavor: variant.flavor,
      weight: variant.weight,
      barcode: variant.barcode,
      photoUrl: variant.photoUrl,
      location: variant.location,
      batch: variant.batch,
      expiresAt: variant.expiresAt,
      costPrice: variant.costPrice.toString(),
      salePrice: variant.salePrice.toString(),
      minQuantity: variant.minQuantity,
      maxQuantity: variant.maxQuantity,
      currentQuantity: variant.currentQuantity,
    };
  }
}

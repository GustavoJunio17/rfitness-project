import { Prisma, type ProductStatus } from "@prisma/client";
import QRCode from "qrcode";
import { conflictError, notFoundError, round2, toNumber, validationError } from "@rfitness/core";
import { prisma } from "../../db";
import { uploadVariantPhoto } from "../../storage/storage";
import { generateUniqueSku } from "./sku-generator";

export interface VariantDto {
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

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  categoryId: string | null;
  categoryName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  variants: VariantDto[];
}

export interface VariantWriteInput {
  sku?: string | null;
  brandId?: string | null;
  flavor?: string | null;
  weight?: string | null;
  barcode?: string | null;
  location?: string | null;
  batch?: string | null;
  expiresAt?: string | null;
  costPrice: number;
  salePrice: number;
  minQuantity: number;
  maxQuantity?: number | null;
  initialQuantity?: number;
}

export interface ProductWriteInput {
  name: string;
  description?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  status?: ProductStatus;
  variants?: VariantWriteInput[];
}

const productInclude = {
  category: { select: { name: true } },
  supplier: { select: { name: true } },
  variants: {
    include: { brand: { select: { name: true } } },
    orderBy: { sku: "asc" },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toProductDto(product: ProductWithRelations): ProductDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    status: product.status,
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    supplierId: product.supplierId,
    supplierName: product.supplier?.name ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      brandId: variant.brandId,
      brandName: variant.brand?.name ?? null,
      flavor: variant.flavor,
      weight: variant.weight,
      barcode: variant.barcode,
      photoUrl: variant.photoUrl,
      location: variant.location,
      batch: variant.batch,
      expiresAt: variant.expiresAt?.toISOString() ?? null,
      costPrice: toNumber(variant.costPrice),
      salePrice: toNumber(variant.salePrice),
      minQuantity: variant.minQuantity,
      maxQuantity: variant.maxQuantity,
      currentQuantity: variant.currentQuantity,
    })),
  };
}

const skuExists = async (sku: string): Promise<boolean> =>
  (await prisma.productVariant.count({ where: { sku } })) > 0;

function assertPrices(input: { costPrice: number; salePrice: number; minQuantity: number }): void {
  if (input.costPrice < 0 || input.salePrice < 0) {
    throw validationError("Preços não podem ser negativos.");
  }
  if (input.minQuantity < 0) {
    throw validationError("A quantidade mínima não pode ser negativa.");
  }
}

export async function listProducts(
  gymId: string,
  filters: { search?: string; categoryId?: string; status?: ProductStatus } = {},
): Promise<ProductDto[]> {
  const products = await prisma.product.findMany({
    where: {
      gymId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { variants: { some: { sku: { contains: filters.search, mode: "insensitive" } } } },
              { variants: { some: { barcode: { contains: filters.search } } } },
              { variants: { some: { flavor: { contains: filters.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: productInclude,
    orderBy: { name: "asc" },
    take: 200,
  });

  return products.map(toProductDto);
}

export async function getProduct(gymId: string, id: string): Promise<ProductDto> {
  const product = await prisma.product.findFirst({ where: { id, gymId }, include: productInclude });
  if (!product) throw notFoundError("Produto não encontrado.");
  return toProductDto(product);
}

async function buildVariantData(
  productName: string,
  input: VariantWriteInput,
): Promise<Prisma.ProductVariantCreateWithoutProductInput> {
  assertPrices(input);

  const brand = input.brandId
    ? await prisma.brand.findUnique({ where: { id: input.brandId }, select: { name: true } })
    : null;

  const sku = await generateUniqueSku(
    {
      productName,
      brandName: brand?.name ?? null,
      flavor: input.flavor ?? null,
      weight: input.weight ?? null,
      desiredSku: input.sku ?? null,
    },
    skuExists,
  );

  return {
    sku,
    ...(input.brandId ? { brand: { connect: { id: input.brandId } } } : {}),
    flavor: input.flavor ?? null,
    weight: input.weight ?? null,
    barcode: input.barcode?.trim() ? input.barcode.trim() : null,
    location: input.location ?? null,
    batch: input.batch ?? null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    costPrice: new Prisma.Decimal(round2(input.costPrice)),
    salePrice: new Prisma.Decimal(round2(input.salePrice)),
    minQuantity: input.minQuantity,
    maxQuantity: input.maxQuantity ?? null,
    currentQuantity: input.initialQuantity ?? 0,
  };
}

/**
 * Cria produto + SKUs. O estoque inicial de cada SKU entra como movimentação IN
 * de verdade — assim a soma dos movimentos continua reconstituindo o saldo, o que
 * não aconteceria se `currentQuantity` nascesse "do nada".
 */
export async function createProduct(
  gymId: string,
  input: ProductWriteInput,
  createdById: string,
): Promise<ProductDto> {
  const variantsData = await Promise.all(
    (input.variants ?? []).map((variant) => buildVariantData(input.name, variant)),
  );

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          gymId,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId ?? null,
          supplierId: input.supplierId ?? null,
          status: input.status ?? "ACTIVE",
          variants: { create: variantsData },
        },
        include: productInclude,
      });

      for (const variant of created.variants) {
        if (variant.currentQuantity > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: variant.id,
              type: "IN",
              quantity: variant.currentQuantity,
              reason: "Estoque inicial",
              createdById,
            },
          });
        }
      }

      return created;
    });

    return toProductDto(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflictError("SKU ou código de barras já cadastrado.");
    }
    throw error;
  }
}

export async function updateProduct(
  gymId: string,
  id: string,
  input: Partial<ProductWriteInput>,
): Promise<ProductDto> {
  await getProduct(gymId, id);

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: productInclude,
  });

  return toProductDto(product);
}

/**
 * Produto com histórico de venda é descontinuado, não apagado — apagar levaria
 * embora os itens de venda (e com eles o histórico financeiro).
 */
export async function deleteProduct(gymId: string, id: string): Promise<{ discontinued: boolean }> {
  await getProduct(gymId, id);

  const soldItems = await prisma.saleItem.count({ where: { variant: { productId: id } } });
  const orderedItems = await prisma.orderItem.count({ where: { variant: { productId: id } } });

  if (soldItems > 0 || orderedItems > 0) {
    await prisma.product.update({ where: { id }, data: { status: "DISCONTINUED" } });
    return { discontinued: true };
  }

  await prisma.product.delete({ where: { id } });
  return { discontinued: false };
}

export async function createVariant(
  gymId: string,
  productId: string,
  input: VariantWriteInput,
  createdById: string,
): Promise<VariantDto> {
  const product = await prisma.product.findFirst({
    where: { id: productId, gymId },
    select: { id: true, name: true },
  });
  if (!product) throw notFoundError("Produto não encontrado.");

  const data = await buildVariantData(product.name, input);

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: { ...data, product: { connect: { id: productId } } },
        include: { brand: { select: { name: true } } },
      });

      if (created.currentQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            variantId: created.id,
            type: "IN",
            quantity: created.currentQuantity,
            reason: "Estoque inicial",
            createdById,
          },
        });
      }

      return created;
    });

    return {
      id: variant.id,
      sku: variant.sku,
      brandId: variant.brandId,
      brandName: variant.brand?.name ?? null,
      flavor: variant.flavor,
      weight: variant.weight,
      barcode: variant.barcode,
      photoUrl: variant.photoUrl,
      location: variant.location,
      batch: variant.batch,
      expiresAt: variant.expiresAt?.toISOString() ?? null,
      costPrice: toNumber(variant.costPrice),
      salePrice: toNumber(variant.salePrice),
      minQuantity: variant.minQuantity,
      maxQuantity: variant.maxQuantity,
      currentQuantity: variant.currentQuantity,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflictError("SKU ou código de barras já cadastrado.");
    }
    throw error;
  }
}

async function findVariantOfGym(gymId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, product: { gymId } },
    include: { brand: { select: { name: true } }, product: { select: { name: true } } },
  });
  if (!variant) throw notFoundError("SKU não encontrado.");
  return variant;
}

/**
 * Atualiza dados cadastrais do SKU. `currentQuantity` **não** é editável aqui:
 * estoque só muda por movimentação, senão o saldo divergiria do histórico.
 */
export async function updateVariant(
  gymId: string,
  variantId: string,
  input: Partial<Omit<VariantWriteInput, "initialQuantity">>,
): Promise<VariantDto> {
  await findVariantOfGym(gymId, variantId);

  if (input.costPrice !== undefined || input.salePrice !== undefined || input.minQuantity !== undefined) {
    assertPrices({
      costPrice: input.costPrice ?? 0,
      salePrice: input.salePrice ?? 0,
      minQuantity: input.minQuantity ?? 0,
    });
  }

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...(input.sku !== undefined && input.sku ? { sku: input.sku.trim().toUpperCase() } : {}),
      ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
      ...(input.flavor !== undefined ? { flavor: input.flavor } : {}),
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode?.trim() || null } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.batch !== undefined ? { batch: input.batch } : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.costPrice !== undefined ? { costPrice: new Prisma.Decimal(round2(input.costPrice)) } : {}),
      ...(input.salePrice !== undefined ? { salePrice: new Prisma.Decimal(round2(input.salePrice)) } : {}),
      ...(input.minQuantity !== undefined ? { minQuantity: input.minQuantity } : {}),
      ...(input.maxQuantity !== undefined ? { maxQuantity: input.maxQuantity } : {}),
    },
    include: { brand: { select: { name: true } } },
  });

  return {
    id: variant.id,
    sku: variant.sku,
    brandId: variant.brandId,
    brandName: variant.brand?.name ?? null,
    flavor: variant.flavor,
    weight: variant.weight,
    barcode: variant.barcode,
    photoUrl: variant.photoUrl,
    location: variant.location,
    batch: variant.batch,
    expiresAt: variant.expiresAt?.toISOString() ?? null,
    costPrice: toNumber(variant.costPrice),
    salePrice: toNumber(variant.salePrice),
    minQuantity: variant.minQuantity,
    maxQuantity: variant.maxQuantity,
    currentQuantity: variant.currentQuantity,
  };
}

export async function findVariantByBarcode(
  gymId: string,
  barcode: string,
): Promise<VariantDto & { productId: string; productName: string }> {
  const variant = await prisma.productVariant.findFirst({
    where: { barcode, product: { gymId } },
    include: { brand: { select: { name: true } }, product: { select: { id: true, name: true } } },
  });
  if (!variant) throw notFoundError("Nenhum SKU encontrado para este código de barras.");

  return {
    id: variant.id,
    sku: variant.sku,
    brandId: variant.brandId,
    brandName: variant.brand?.name ?? null,
    flavor: variant.flavor,
    weight: variant.weight,
    barcode: variant.barcode,
    photoUrl: variant.photoUrl,
    location: variant.location,
    batch: variant.batch,
    expiresAt: variant.expiresAt?.toISOString() ?? null,
    costPrice: toNumber(variant.costPrice),
    salePrice: toNumber(variant.salePrice),
    minQuantity: variant.minQuantity,
    maxQuantity: variant.maxQuantity,
    currentQuantity: variant.currentQuantity,
    productId: variant.product.id,
    productName: variant.product.name,
  };
}

export async function generateVariantQrCode(
  gymId: string,
  variantId: string,
): Promise<{ sku: string; dataUrl: string }> {
  const variant = await findVariantOfGym(gymId, variantId);
  const dataUrl = await QRCode.toDataURL(variant.sku, { width: 320, margin: 1 });
  return { sku: variant.sku, dataUrl };
}

export async function setVariantPhoto(gymId: string, variantId: string, file: File): Promise<VariantDto> {
  await findVariantOfGym(gymId, variantId);
  const photoUrl = await uploadVariantPhoto({ gymId, variantId, file });

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: { photoUrl },
    include: { brand: { select: { name: true } } },
  });

  return {
    id: variant.id,
    sku: variant.sku,
    brandId: variant.brandId,
    brandName: variant.brand?.name ?? null,
    flavor: variant.flavor,
    weight: variant.weight,
    barcode: variant.barcode,
    photoUrl: variant.photoUrl,
    location: variant.location,
    batch: variant.batch,
    expiresAt: variant.expiresAt?.toISOString() ?? null,
    costPrice: toNumber(variant.costPrice),
    salePrice: toNumber(variant.salePrice),
    minQuantity: variant.minQuantity,
    maxQuantity: variant.maxQuantity,
    currentQuantity: variant.currentQuantity,
  };
}

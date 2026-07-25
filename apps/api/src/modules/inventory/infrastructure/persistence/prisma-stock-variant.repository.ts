import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type { StockVariantRepository, StockVariantSnapshot } from "../../domain/repositories/stock-variant.repository";

@Injectable()
export class PrismaStockVariantRepository implements StockVariantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(gymId: string, variantId: string): Promise<StockVariantSnapshot | null> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { gymId } },
      include: { product: { select: { gymId: true } } },
    });
    return variant ? this.toDomain(variant) : null;
  }

  async listAllWithStock(): Promise<StockVariantSnapshot[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { currentQuantity: { gt: 0 } },
      include: { product: { select: { gymId: true } } },
    });
    return variants.map((variant) => this.toDomain(variant));
  }

  private toDomain(variant: {
    id: string;
    sku: string;
    minQuantity: number;
    maxQuantity: number | null;
    currentQuantity: number;
    expiresAt: Date | null;
    product: { gymId: string };
  }): StockVariantSnapshot {
    return {
      id: variant.id,
      gymId: variant.product.gymId,
      sku: variant.sku,
      minQuantity: variant.minQuantity,
      maxQuantity: variant.maxQuantity,
      currentQuantity: variant.currentQuantity,
      expiresAt: variant.expiresAt,
    };
  }
}

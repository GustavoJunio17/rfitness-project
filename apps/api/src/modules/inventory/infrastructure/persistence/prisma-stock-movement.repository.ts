import { Injectable } from "@nestjs/common";
import type { StockMovementType } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  CreateStockMovementInput,
  StockMovement,
  StockMovementFilters,
  StockMovementRepository,
} from "../../domain/repositories/stock-movement.repository";

@Injectable()
export class PrismaStockMovementRepository implements StockMovementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAndApplyQuantity(input: CreateStockMovementInput, resultingQuantity: number): Promise<StockMovement> {
    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          variantId: input.variantId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
          createdById: input.createdById,
        },
      }),
      this.prisma.productVariant.update({
        where: { id: input.variantId },
        data: { currentQuantity: resultingQuantity },
      }),
    ]);
    return movement;
  }

  findMany(gymId: string, filters: StockMovementFilters): Promise<StockMovement[]> {
    return this.prisma.stockMovement.findMany({
      where: {
        variantId: filters.variantId,
        type: filters.type,
        variant: { product: { gymId } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async countByTypesSince(variantId: string, types: StockMovementType[], since: Date): Promise<number> {
    return this.prisma.stockMovement.count({
      where: { variantId, type: { in: types }, createdAt: { gte: since } },
    });
  }
}

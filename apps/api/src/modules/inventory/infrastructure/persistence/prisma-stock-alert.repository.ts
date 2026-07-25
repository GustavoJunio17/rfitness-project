import { Injectable } from "@nestjs/common";
import type { StockAlertType } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  CreateStockAlertInput,
  StockAlert,
  StockAlertFilters,
  StockAlertRepository,
} from "../../domain/repositories/stock-alert.repository";

@Injectable()
export class PrismaStockAlertRepository implements StockAlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOpenByVariantAndType(variantId: string, type: StockAlertType): Promise<StockAlert | null> {
    return this.prisma.stockAlert.findFirst({
      where: { variantId, type, resolvedAt: null },
    });
  }

  create(input: CreateStockAlertInput): Promise<StockAlert> {
    return this.prisma.stockAlert.create({
      data: { variantId: input.variantId, type: input.type, message: input.message },
    });
  }

  async resolve(id: string): Promise<void> {
    await this.prisma.stockAlert.update({ where: { id }, data: { resolvedAt: new Date() } });
  }

  findMany(gymId: string, filters: StockAlertFilters): Promise<StockAlert[]> {
    return this.prisma.stockAlert.findMany({
      where: {
        variant: { product: { gymId } },
        resolvedAt: filters.resolved === undefined ? undefined : filters.resolved ? { not: null } : null,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  findById(gymId: string, id: string): Promise<StockAlert | null> {
    return this.prisma.stockAlert.findFirst({
      where: { id, variant: { product: { gymId } } },
    });
  }
}

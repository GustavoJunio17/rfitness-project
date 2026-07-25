import { Injectable } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  CreateSaleInput,
  Sale,
  SaleFilters,
  SaleRepository,
  SellableVariant,
} from "../../domain/repositories/sale.repository";

type PrismaSaleWithItems = Prisma.SaleGetPayload<{ include: { items: true } }>;

@Injectable()
export class PrismaSaleRepository implements SaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSellableVariants(gymId: string, variantIds: string[]): Promise<SellableVariant[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { gymId } },
    });
    return variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      minQuantity: variant.minQuantity,
      currentQuantity: variant.currentQuantity,
      costPrice: variant.costPrice.toString(),
      salePrice: variant.salePrice.toString(),
    }));
  }

  async create(input: CreateSaleInput): Promise<Sale> {
    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          gymId: input.gymId,
          studentId: input.studentId,
          employeeId: input.employeeId,
          paymentMethod: input.paymentMethod,
          discount: input.discount,
          totalAmount: input.totalAmount,
          totalProfit: input.totalProfit,
          items: {
            create: input.lines.map((line) => ({
              variantId: line.variantId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
            })),
          },
        },
        include: { items: true },
      });

      for (const line of input.lines) {
        // eslint-disable-next-line no-await-in-loop
        await tx.stockMovement.create({
          data: {
            variantId: line.variantId,
            type: "SALE",
            quantity: -line.quantity,
            reason: `Venda ${created.id}`,
          },
        });
        // eslint-disable-next-line no-await-in-loop
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { currentQuantity: line.resultingQuantity },
        });
      }

      return created;
    });

    return this.toDomain(sale);
  }

  async findMany(gymId: string, filters: SaleFilters): Promise<Sale[]> {
    const sales = await this.prisma.sale.findMany({
      where: {
        gymId,
        employeeId: filters.employeeId,
        createdAt:
          filters.from || filters.to
            ? { gte: filters.from, lte: filters.to }
            : undefined,
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return sales.map((sale) => this.toDomain(sale));
  }

  async findById(gymId: string, id: string): Promise<Sale | null> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, gymId },
      include: { items: true },
    });
    return sale ? this.toDomain(sale) : null;
  }

  private toDomain(sale: PrismaSaleWithItems): Sale {
    return {
      id: sale.id,
      gymId: sale.gymId,
      studentId: sale.studentId,
      employeeId: sale.employeeId,
      paymentMethod: sale.paymentMethod,
      discount: sale.discount.toString(),
      totalAmount: sale.totalAmount.toString(),
      totalProfit: sale.totalProfit.toString(),
      createdAt: sale.createdAt,
      items: sale.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        unitCost: item.unitCost.toString(),
      })),
    };
  }
}

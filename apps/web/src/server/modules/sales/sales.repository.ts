import { Prisma } from "@prisma/client";
import type { SellableVariant } from "@rfitness/core";
import { toNumber } from "@rfitness/core";
import { prisma } from "../../db";
import { publishRealtime } from "../../realtime/publisher";
import { inventoryService } from "../inventory/inventory.repository";
import { registerSaleRevenue } from "../finance/cash-flow.service";
import { createSalesService } from "./sales.service";
import type {
  CreateSalePersistenceInput,
  SaleFilters,
  SaleRecord,
  SalesRepository,
  SalesSideEffects,
} from "./sales.ports";

const saleInclude = {
  student: { select: { name: true } },
  employee: { select: { name: true } },
  items: {
    include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
  },
} satisfies Prisma.SaleInclude;

type SaleWithRelations = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

function toSaleRecord(sale: SaleWithRelations): SaleRecord {
  return {
    id: sale.id,
    totalAmount: toNumber(sale.totalAmount),
    totalProfit: toNumber(sale.totalProfit),
    discount: toNumber(sale.discount),
    paymentMethod: sale.paymentMethod,
    studentName: sale.student?.name ?? null,
    employeeName: sale.employee.name,
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      variantId: item.variantId,
      sku: item.variant.sku,
      productName: item.variant.product.name,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      unitCost: toNumber(item.unitCost),
    })),
  };
}

export const prismaSalesRepository: SalesRepository = {
  async findSellableVariants(gymId: string, variantIds: string[]): Promise<SellableVariant[]> {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { gymId } },
      select: {
        id: true,
        sku: true,
        salePrice: true,
        costPrice: true,
        currentQuantity: true,
        minQuantity: true,
      },
    });

    return variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      salePrice: toNumber(variant.salePrice),
      costPrice: toNumber(variant.costPrice),
      currentQuantity: variant.currentQuantity,
      minQuantity: variant.minQuantity,
    }));
  },

  async create(input: CreateSalePersistenceInput): Promise<SaleRecord> {
    /**
     * Venda inteira em uma transação: cabeçalho, itens, um StockMovement SALE por
     * SKU e a baixa de estoque. Qualquer falha desfaz tudo — não existe venda
     * gravada sem baixa, nem baixa sem venda.
     */
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          gymId: input.gymId,
          employeeId: input.employeeId,
          studentId: input.studentId,
          paymentMethod: input.paymentMethod,
          discount: new Prisma.Decimal(input.discount),
          totalAmount: new Prisma.Decimal(input.totalAmount),
          totalProfit: new Prisma.Decimal(input.totalProfit),
          items: {
            create: input.lines.map((line) => ({
              variantId: line.variantId,
              quantity: line.quantity,
              unitPrice: new Prisma.Decimal(line.unitPrice),
              unitCost: new Prisma.Decimal(line.unitCost),
            })),
          },
        },
        include: saleInclude,
      });

      for (const line of input.lines) {
        await tx.stockMovement.create({
          data: {
            variantId: line.variantId,
            type: "SALE",
            quantity: -line.quantity,
            reason: `Venda ${sale.id}`,
            createdById: input.employeeId,
          },
        });
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { currentQuantity: line.resultingQuantity },
        });
      }

      return toSaleRecord(sale);
    });
  },

  async findMany(gymId: string, filters: SaleFilters): Promise<SaleRecord[]> {
    const sales = await prisma.sale.findMany({
      where: {
        gymId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100,
    });

    return sales.map(toSaleRecord);
  },

  async findById(gymId: string, id: string): Promise<SaleRecord | null> {
    const sale = await prisma.sale.findFirst({ where: { id, gymId }, include: saleInclude });
    return sale ? toSaleRecord(sale) : null;
  },
};

export const salesSideEffects: SalesSideEffects = {
  evaluateLowStock: (variant) => inventoryService.evaluateLowStock(variant),
  registerSaleRevenue,
  publish: publishRealtime,
};

export const salesService = createSalesService(prismaSalesRepository, salesSideEffects);

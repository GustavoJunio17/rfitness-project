import type { PaymentMethodType } from "@prisma/client";
import { computeSaleTotals, mergeCartItems, notFoundError, type CartItem } from "@rfitness/core";
import type { SaleFilters, SaleRecord, SalesRepository, SalesSideEffects } from "./sales.ports";

export interface CreateSaleInput {
  items: CartItem[];
  paymentMethod: PaymentMethodType;
  discount?: number;
  studentId?: string | null;
}

export function createSalesService(repository: SalesRepository, sideEffects: SalesSideEffects) {
  async function createSale(gymId: string, employeeId: string, input: CreateSaleInput): Promise<SaleRecord> {
    const merged = mergeCartItems(input.items);
    const variants = await repository.findSellableVariants(
      gymId,
      merged.map((item) => item.variantId),
    );

    // Todo o cálculo (fusão, estoque, desconto, lucro) é regra pura do core.
    const totals = computeSaleTotals({ items: merged, variants, discount: input.discount });

    const sale = await repository.create({
      gymId,
      employeeId,
      studentId: input.studentId ?? null,
      paymentMethod: input.paymentMethod,
      discount: totals.discount,
      totalAmount: totals.totalAmount,
      totalProfit: totals.totalProfit,
      lines: totals.lines,
    });

    // A venda já está commitada: daqui para baixo nada pode virar erro para o
    // operador do PDV.
    try {
      const variantById = new Map(variants.map((variant) => [variant.id, variant]));
      await Promise.all(
        totals.lines.map((line) => {
          const variant = variantById.get(line.variantId);
          if (!variant) return Promise.resolve();
          return sideEffects.evaluateLowStock({
            id: variant.id,
            gymId,
            sku: variant.sku,
            minQuantity: variant.minQuantity,
            currentQuantity: line.resultingQuantity,
          });
        }),
      );
      await sideEffects.registerSaleRevenue(gymId, sale.id, sale.totalAmount);
      await sideEffects.publish(gymId, "sale.created", { saleId: sale.id });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[sales] efeito colateral pós-venda falhou para ${sale.id}:`, error);
    }

    return sale;
  }

  function listSales(gymId: string, filters: SaleFilters): Promise<SaleRecord[]> {
    return repository.findMany(gymId, filters);
  }

  async function getSale(gymId: string, id: string): Promise<SaleRecord> {
    const sale = await repository.findById(gymId, id);
    if (!sale) throw notFoundError("Venda não encontrada.");
    return sale;
  }

  return { createSale, listSales, getSale };
}

export type SalesService = ReturnType<typeof createSalesService>;

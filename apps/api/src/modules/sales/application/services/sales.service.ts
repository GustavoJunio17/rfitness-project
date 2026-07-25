import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { LowStockAlertService } from "../../../inventory/application/services/low-stock-alert.service";
import { CashFlowService } from "../../../finance/application/services/cash-flow.service";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";
import {
  SALE_REPOSITORY,
  Sale,
  SaleFilters,
  SaleLineToCreate,
  SaleRepository,
} from "../../domain/repositories/sale.repository";
import { CreateSaleDto } from "../dto/create-sale.dto";

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepository,
    private readonly lowStockAlertService: LowStockAlertService,
    private readonly cashFlowService: CashFlowService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createSale(gymId: string, employeeId: string, dto: CreateSaleDto): Promise<Sale> {
    // Merge duplicate SKUs so stock is validated/decremented once per variant,
    // not once per cart line — otherwise two lines for the same SKU would both
    // read the same pre-sale `currentQuantity` and under-count the deduction.
    const mergedQuantities = new Map<string, number>();
    for (const item of dto.items) {
      mergedQuantities.set(item.variantId, (mergedQuantities.get(item.variantId) ?? 0) + item.quantity);
    }
    const variantIds = [...mergedQuantities.keys()];

    const sellableVariants = await this.sales.findSellableVariants(gymId, variantIds);
    const variantById = new Map(sellableVariants.map((variant) => [variant.id, variant]));
    if (variantById.size !== variantIds.length) {
      throw new NotFoundException("Um ou mais SKUs não foram encontrados nesta academia.");
    }

    const lines: SaleLineToCreate[] = [];
    let subtotal = 0;
    let profitBeforeDiscount = 0;

    for (const [variantId, quantity] of mergedQuantities) {
      const variant = variantById.get(variantId)!;
      if (variant.currentQuantity < quantity) {
        throw new BadRequestException(`Estoque insuficiente para o SKU ${variant.sku}.`);
      }
      const unitPrice = Number(variant.salePrice);
      const unitCost = Number(variant.costPrice);
      subtotal += unitPrice * quantity;
      profitBeforeDiscount += (unitPrice - unitCost) * quantity;
      lines.push({
        variantId,
        quantity,
        unitPrice,
        unitCost,
        resultingQuantity: variant.currentQuantity - quantity,
      });
    }

    const discount = dto.discount ?? 0;
    if (discount > subtotal) {
      throw new BadRequestException("O desconto não pode ser maior que o subtotal da venda.");
    }

    const sale = await this.sales.create({
      gymId,
      studentId: dto.studentId,
      employeeId,
      paymentMethod: dto.paymentMethod,
      discount,
      totalAmount: subtotal - discount,
      totalProfit: profitBeforeDiscount - discount,
      lines,
    });

    // Best-effort, post-commit: the sale already succeeded in the DB, so a failure
    // in any of these side effects must never surface as an error response for a
    // sale that in fact went through.
    try {
      await Promise.all(
        lines.map((line) => {
          const variant = variantById.get(line.variantId)!;
          return this.lowStockAlertService.evaluate({
            id: variant.id,
            gymId,
            sku: variant.sku,
            minQuantity: variant.minQuantity,
            currentQuantity: line.resultingQuantity,
          });
        }),
      );
      await this.cashFlowService.registerSaleRevenue(gymId, sale.id, Number(sale.totalAmount));
      this.realtimeService.emitToGym(gymId, "sale.created", { saleId: sale.id });
    } catch (error) {
      this.logger.warn(`Efeito colateral pós-venda falhou para a venda ${sale.id}: ${error}`);
    }

    return sale;
  }

  listSales(gymId: string, filters: SaleFilters): Promise<Sale[]> {
    return this.sales.findMany(gymId, filters);
  }

  async getSale(gymId: string, id: string): Promise<Sale> {
    const sale = await this.sales.findById(gymId, id);
    if (!sale) throw new NotFoundException("Venda não encontrada.");
    return sale;
  }
}

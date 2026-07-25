import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { StockMovementType } from "@rfitness/database";
import { STOCK_VARIANT_REPOSITORY, StockVariantRepository } from "../../domain/repositories/stock-variant.repository";
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovement,
  StockMovementFilters,
  StockMovementRepository,
} from "../../domain/repositories/stock-movement.repository";
import { STOCK_ALERT_REPOSITORY, StockAlert, StockAlertRepository } from "../../domain/repositories/stock-alert.repository";
import { RegisterStockMovementDto } from "../dto/register-stock-movement.dto";
import { LowStockAlertService } from "./low-stock-alert.service";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";

@Injectable()
export class InventoryService {
  constructor(
    @Inject(STOCK_VARIANT_REPOSITORY) private readonly variants: StockVariantRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
    @Inject(STOCK_ALERT_REPOSITORY) private readonly alerts: StockAlertRepository,
    private readonly lowStockAlertService: LowStockAlertService,
    private readonly realtimeService?: RealtimeService,
  ) {}

  async registerMovement(
    gymId: string,
    dto: RegisterStockMovementDto,
    createdById: string,
  ): Promise<StockMovement> {
    const variant = await this.variants.findById(gymId, dto.variantId);
    if (!variant) throw new NotFoundException("SKU não encontrado.");

    const delta = this.computeDelta(dto.type, dto.quantity, variant.currentQuantity);
    const resultingQuantity = variant.currentQuantity + delta;
    if (resultingQuantity < 0) {
      throw new BadRequestException("Quantidade insuficiente em estoque para esta movimentação.");
    }

    const movement = await this.movements.createAndApplyQuantity(
      { variantId: variant.id, type: dto.type, quantity: delta, reason: dto.reason, createdById },
      resultingQuantity,
    );

    await this.lowStockAlertService.evaluate({ ...variant, currentQuantity: resultingQuantity });
    this.realtimeService?.emitToGym(gymId, "stock.movement.created", { variantId: variant.id });
    return movement;
  }

  listMovements(gymId: string, filters: StockMovementFilters): Promise<StockMovement[]> {
    return this.movements.findMany(gymId, filters);
  }

  listAlerts(gymId: string, resolved?: boolean): Promise<StockAlert[]> {
    return this.alerts.findMany(gymId, { resolved });
  }

  async resolveAlert(gymId: string, id: string): Promise<void> {
    const alert = await this.alerts.findById(gymId, id);
    if (!alert) throw new NotFoundException("Alerta não encontrado.");
    await this.alerts.resolve(id);
  }

  /**
   * Sign convention: every `StockMovement.quantity` (and thus the value returned
   * here) is the real delta applied to `currentQuantity` — never a raw user input.
   * IN/EXCHANGE add, OUT/SALE/LOSS/EXPIRATION subtract, and INVENTORY_ADJUSTMENT's
   * DTO quantity is the freshly counted total (delta = counted - current).
   */
  private computeDelta(type: StockMovementType, quantity: number, currentQuantity: number): number {
    switch (type) {
      case StockMovementType.IN:
        if (quantity <= 0) throw new BadRequestException("Quantidade deve ser positiva para entrada.");
        return quantity;
      case StockMovementType.EXCHANGE:
        return quantity;
      case StockMovementType.OUT:
      case StockMovementType.SALE:
      case StockMovementType.LOSS:
      case StockMovementType.EXPIRATION:
        if (quantity <= 0) throw new BadRequestException("Quantidade deve ser positiva.");
        return -quantity;
      case StockMovementType.INVENTORY_ADJUSTMENT:
        return quantity - currentQuantity;
      default:
        throw new BadRequestException("Tipo de movimentação inválido.");
    }
  }
}

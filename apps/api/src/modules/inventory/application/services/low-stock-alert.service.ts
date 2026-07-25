import { Inject, Injectable } from "@nestjs/common";
import { STOCK_ALERT_REPOSITORY, StockAlertRepository } from "../../domain/repositories/stock-alert.repository";
import type { StockVariantSnapshot } from "../../domain/repositories/stock-variant.repository";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";
import { NotificationsService } from "../../../notifications/application/services/notifications.service";

/**
 * Shared across modules that mutate stock (inventory movements, sales) so the
 * "below minimum -> open alert; back above -> resolve it" rule lives in one place
 * instead of being re-implemented per caller.
 */
@Injectable()
export class LowStockAlertService {
  constructor(
    @Inject(STOCK_ALERT_REPOSITORY) private readonly alerts: StockAlertRepository,
    private readonly realtimeService?: RealtimeService,
    private readonly notificationsService?: NotificationsService,
  ) {}

  async evaluate(
    variant: Pick<StockVariantSnapshot, "id" | "sku" | "minQuantity" | "currentQuantity"> & { gymId: string },
  ): Promise<void> {
    const existingAlert = await this.alerts.findOpenByVariantAndType(variant.id, "LOW_STOCK");
    const isLow = variant.currentQuantity <= variant.minQuantity;

    if (isLow && !existingAlert) {
      const message = `Estoque baixo: ${variant.sku} (${variant.currentQuantity}/${variant.minQuantity})`;
      await this.alerts.create({ variantId: variant.id, type: "LOW_STOCK", message });
      this.realtimeService?.emitToGym(variant.gymId, "stock.alert.created", {
        variantId: variant.id,
        type: "LOW_STOCK",
      });
      await this.notificationsService?.create(variant.gymId, "LOW_STOCK", "Estoque baixo", message);
    } else if (!isLow && existingAlert) {
      await this.alerts.resolve(existingAlert.id);
      this.realtimeService?.emitToGym(variant.gymId, "stock.alert.resolved", {
        variantId: variant.id,
        type: "LOW_STOCK",
      });
    }
  }
}

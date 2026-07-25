import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { StockMovementType } from "@rfitness/database";
import {
  STOCK_VARIANT_REPOSITORY,
  StockVariantRepository,
  StockVariantSnapshot,
} from "../../domain/repositories/stock-variant.repository";
import { STOCK_MOVEMENT_REPOSITORY, StockMovementRepository } from "../../domain/repositories/stock-movement.repository";
import { STOCK_ALERT_REPOSITORY, StockAlertRepository } from "../../domain/repositories/stock-alert.repository";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";

/**
 * Daily sweep for time-based stock alerts (expiry/staleness) — unlike LOW_STOCK,
 * these can't be evaluated reactively on a single write, since they depend on the
 * passage of time rather than a specific movement.
 *
 * STALE only becomes meaningful once Sales (Fase 3) starts recording SALE
 * movements — until then, most variants with any stock will read as "parada"
 * simply for lack of movement data. That is expected, not a bug.
 */
@Injectable()
export class StockAlertScheduler {
  private readonly logger = new Logger(StockAlertScheduler.name);

  constructor(
    @Inject(STOCK_VARIANT_REPOSITORY) private readonly variants: StockVariantRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
    @Inject(STOCK_ALERT_REPOSITORY) private readonly alerts: StockAlertRepository,
    private readonly configService: ConfigService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyCheck(): Promise<void> {
    const variants = await this.variants.listAllWithStock();
    this.logger.log(`Verificando alertas de validade/estoque parado em ${variants.length} SKUs.`);
    await Promise.all(variants.map((variant) => this.evaluateVariant(variant)));
  }

  private async evaluateVariant(variant: StockVariantSnapshot): Promise<void> {
    await Promise.all([this.evaluateExpiry(variant), this.evaluateStale(variant)]);
  }

  private async evaluateExpiry(variant: StockVariantSnapshot): Promise<void> {
    const now = new Date();
    const expiringSoonDays = this.configService.get<number>("inventory.expiringSoonDays") ?? 7;
    const expiringSoonThreshold = new Date(now.getTime() + expiringSoonDays * 86_400_000);

    const [expiredAlert, expiringSoonAlert] = await Promise.all([
      this.alerts.findOpenByVariantAndType(variant.id, "EXPIRED"),
      this.alerts.findOpenByVariantAndType(variant.id, "EXPIRING_SOON"),
    ]);

    const isExpired = Boolean(variant.expiresAt && variant.expiresAt < now);
    const isExpiringSoon = Boolean(
      variant.expiresAt && !isExpired && variant.expiresAt <= expiringSoonThreshold,
    );

    if (isExpired && !expiredAlert) {
      await this.alerts.create({
        variantId: variant.id,
        type: "EXPIRED",
        message: `Produto vencido: ${variant.sku}`,
      });
      this.realtimeService.emitToGym(variant.gymId, "stock.alert.created", { variantId: variant.id, type: "EXPIRED" });
    } else if (!isExpired && expiredAlert) {
      await this.alerts.resolve(expiredAlert.id);
      this.realtimeService.emitToGym(variant.gymId, "stock.alert.resolved", { variantId: variant.id, type: "EXPIRED" });
    }

    if (isExpiringSoon && !expiringSoonAlert) {
      await this.alerts.create({
        variantId: variant.id,
        type: "EXPIRING_SOON",
        message: `Produto vencendo em breve: ${variant.sku}`,
      });
      this.realtimeService.emitToGym(variant.gymId, "stock.alert.created", {
        variantId: variant.id,
        type: "EXPIRING_SOON",
      });
    } else if (!isExpiringSoon && expiringSoonAlert) {
      await this.alerts.resolve(expiringSoonAlert.id);
      this.realtimeService.emitToGym(variant.gymId, "stock.alert.resolved", {
        variantId: variant.id,
        type: "EXPIRING_SOON",
      });
    }
  }

  private async evaluateStale(variant: StockVariantSnapshot): Promise<void> {
    const staleAfterDays = this.configService.get<number>("inventory.staleAfterDays") ?? 60;
    const since = new Date(Date.now() - staleAfterDays * 86_400_000);

    const movementsCount = await this.movements.countByTypesSince(
      variant.id,
      [StockMovementType.OUT, StockMovementType.SALE],
      since,
    );
    const staleAlert = await this.alerts.findOpenByVariantAndType(variant.id, "STALE");
    const isStale = movementsCount === 0;

    if (isStale && !staleAlert) {
      await this.alerts.create({
        variantId: variant.id,
        type: "STALE",
        message: `Produto parado há mais de ${staleAfterDays} dias: ${variant.sku}`,
      });
      this.realtimeService.emitToGym(variant.gymId, "stock.alert.created", { variantId: variant.id, type: "STALE" });
    } else if (!isStale && staleAlert) {
      await this.alerts.resolve(staleAlert.id);
      this.realtimeService.emitToGym(variant.gymId, "stock.alert.resolved", { variantId: variant.id, type: "STALE" });
    }
  }
}

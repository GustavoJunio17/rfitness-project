import { decideExpiryAlerts, decideStaleAlert } from "@rfitness/core";
import { prisma } from "../../db";
import { getEnv } from "../../env";
import { publishRealtime } from "../../realtime/publisher";
import { createNotification } from "../notifications/notifications.service";

export interface SweepResult {
  variantsChecked: number;
  opened: number;
  resolved: number;
}

/**
 * Varredura diária dos alertas **temporais** de estoque (validade e produto
 * parado). Diferente do LOW_STOCK — reavaliado a cada movimentação —, estes
 * dependem só da passagem do tempo, então precisam de execução agendada
 * (Vercel Cron chamando /api/cron/stock-alerts).
 */
export async function sweepStockAlerts(now = new Date()): Promise<SweepResult> {
  const env = getEnv();
  const result: SweepResult = { variantsChecked: 0, opened: 0, resolved: 0 };

  const variants = await prisma.productVariant.findMany({
    where: { product: { status: { not: "DISCONTINUED" } } },
    select: {
      id: true,
      sku: true,
      expiresAt: true,
      createdAt: true,
      product: { select: { gymId: true } },
      stockAlerts: { where: { resolvedAt: null }, select: { id: true, type: true } },
      stockMovements: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  for (const variant of variants) {
    result.variantsChecked += 1;
    const gymId = variant.product.gymId;
    const openByType = new Map(variant.stockAlerts.map((alert) => [alert.type, alert.id]));

    const expiry = decideExpiryAlerts({
      expiresAt: variant.expiresAt,
      now,
      expiringSoonDays: env.STOCK_EXPIRING_SOON_DAYS,
      hasOpenExpired: openByType.has("EXPIRED"),
      hasOpenExpiringSoon: openByType.has("EXPIRING_SOON"),
    });

    const stale = decideStaleAlert({
      lastMovementAt: variant.stockMovements[0]?.createdAt ?? null,
      createdAt: variant.createdAt,
      now,
      staleAfterDays: env.STOCK_STALE_AFTER_DAYS,
      hasOpenAlert: openByType.has("STALE"),
    });

    const decisions = [
      { type: "EXPIRED" as const, decision: expiry.expired, message: `Produto vencido: ${variant.sku}` },
      {
        type: "EXPIRING_SOON" as const,
        decision: expiry.expiringSoon,
        message: `Validade próxima (${env.STOCK_EXPIRING_SOON_DAYS} dias): ${variant.sku}`,
      },
      {
        type: "STALE" as const,
        decision: stale,
        message: `Produto parado há mais de ${env.STOCK_STALE_AFTER_DAYS} dias: ${variant.sku}`,
      },
    ];

    for (const { type, decision, message } of decisions) {
      if (decision === "OPEN") {
        // eslint-disable-next-line no-await-in-loop
        await prisma.stockAlert.create({ data: { variantId: variant.id, type, message } });
        // eslint-disable-next-line no-await-in-loop
        await publishRealtime(gymId, "stock.alert.created", { variantId: variant.id, type });
        // eslint-disable-next-line no-await-in-loop
        await createNotification(gymId, "LOW_STOCK", "Alerta de estoque", message);
        result.opened += 1;
      } else if (decision === "RESOLVE") {
        const alertId = openByType.get(type);
        if (!alertId) continue;
        // eslint-disable-next-line no-await-in-loop
        await prisma.stockAlert.update({ where: { id: alertId }, data: { resolvedAt: now } });
        // eslint-disable-next-line no-await-in-loop
        await publishRealtime(gymId, "stock.alert.resolved", { variantId: variant.id, type });
        result.resolved += 1;
      }
    }
  }

  return result;
}

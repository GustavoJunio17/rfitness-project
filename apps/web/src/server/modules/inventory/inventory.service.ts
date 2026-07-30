import type { StockMovementType } from "@prisma/client";
import { applyStockDelta, computeStockDelta, decideLowStockAlert, notFoundError } from "@rfitness/core";
import type {
  AlertRecord,
  InventoryEvents,
  InventoryRepository,
  MovementFilters,
  MovementRecord,
} from "./inventory.ports";

export interface RegisterMovementInput {
  variantId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string | null;
}

export interface LowStockInput {
  id: string;
  gymId: string;
  sku: string;
  minQuantity: number;
  currentQuantity: number;
}

export function createInventoryService(repository: InventoryRepository, events: InventoryEvents) {
  /**
   * Regra de estoque baixo em um único lugar — chamada por movimentação, venda e
   * entrega de pedido. Best-effort: já vem depois da operação confirmada.
   */
  async function evaluateLowStock(variant: LowStockInput): Promise<void> {
    try {
      const openAlert = await repository.findOpenAlert(variant.id, "LOW_STOCK");
      const decision = decideLowStockAlert({
        minQuantity: variant.minQuantity,
        currentQuantity: variant.currentQuantity,
        hasOpenAlert: Boolean(openAlert),
      });

      if (decision === "OPEN") {
        const message = `Estoque baixo: ${variant.sku} (${variant.currentQuantity}/${variant.minQuantity})`;
        await repository.createAlert({ variantId: variant.id, type: "LOW_STOCK", message });
        await events.publish(variant.gymId, "stock.alert.created", {
          variantId: variant.id,
          type: "LOW_STOCK",
        });
        await events.notify(variant.gymId, "LOW_STOCK", "Estoque baixo", message);
      } else if (decision === "RESOLVE" && openAlert) {
        await repository.resolveAlert(openAlert.id);
        await events.publish(variant.gymId, "stock.alert.resolved", {
          variantId: variant.id,
          type: "LOW_STOCK",
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[inventory] falha ao avaliar estoque baixo do SKU ${variant.sku}:`, error);
    }
  }

  async function registerMovement(
    gymId: string,
    input: RegisterMovementInput,
    createdById: string | null,
  ): Promise<MovementRecord> {
    const variant = await repository.findVariant(gymId, input.variantId);
    if (!variant) throw notFoundError("SKU não encontrado.");

    const delta = computeStockDelta(input.type, input.quantity, variant.currentQuantity);
    const resultingQuantity = applyStockDelta(variant.currentQuantity, delta);

    const movement = await repository.applyMovement({
      variantId: variant.id,
      type: input.type,
      quantity: delta,
      reason: input.reason ?? null,
      createdById,
      resultingQuantity,
    });

    await evaluateLowStock({ ...variant, currentQuantity: resultingQuantity });
    await events.publish(gymId, "stock.movement.created", { variantId: variant.id });

    return movement;
  }

  function listMovements(gymId: string, filters: MovementFilters): Promise<MovementRecord[]> {
    return repository.listMovements(gymId, filters);
  }

  function listAlerts(gymId: string, resolved?: boolean): Promise<AlertRecord[]> {
    return repository.listAlerts(gymId, resolved);
  }

  async function resolveAlert(gymId: string, id: string): Promise<void> {
    const alert = await repository.findAlert(gymId, id);
    if (!alert) throw notFoundError("Alerta não encontrado.");
    if (alert.resolvedAt) return;

    await repository.resolveAlert(id);
    await events.publish(gymId, "stock.alert.resolved", { alertId: id });
  }

  return { registerMovement, listMovements, listAlerts, resolveAlert, evaluateLowStock };
}

export type InventoryService = ReturnType<typeof createInventoryService>;

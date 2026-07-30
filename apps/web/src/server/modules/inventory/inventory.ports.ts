import type { NotificationType, StockAlertType, StockMovementType } from "@prisma/client";
import type { RealtimeEventType } from "../../realtime/signal";

export interface VariantSnapshot {
  id: string;
  gymId: string;
  sku: string;
  minQuantity: number;
  currentQuantity: number;
  createdAt: Date;
}

export interface MovementRecord {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  type: StockMovementType;
  /** Delta aplicado (pode ser negativo). */
  quantity: number;
  reason: string | null;
  createdAt: Date;
}

export interface AlertRecord {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  type: StockAlertType;
  message: string;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface MovementFilters {
  variantId?: string;
  type?: StockMovementType;
  limit?: number;
}

export interface ApplyMovementInput {
  variantId: string;
  type: StockMovementType;
  /** Delta real, já calculado pelo core. */
  quantity: number;
  reason: string | null;
  createdById: string | null;
  resultingQuantity: number;
}

/**
 * Porta de persistência do estoque. O service depende desta interface (e não do
 * Prisma) para que a regra de sinal e a de alerta sejam testáveis sem banco.
 */
export interface InventoryRepository {
  findVariant(gymId: string, variantId: string): Promise<VariantSnapshot | null>;
  applyMovement(input: ApplyMovementInput): Promise<MovementRecord>;
  listMovements(gymId: string, filters: MovementFilters): Promise<MovementRecord[]>;
  findOpenAlert(variantId: string, type: StockAlertType): Promise<{ id: string } | null>;
  createAlert(input: { variantId: string; type: StockAlertType; message: string }): Promise<{ id: string }>;
  resolveAlert(id: string): Promise<void>;
  listAlerts(gymId: string, resolved?: boolean): Promise<AlertRecord[]>;
  findAlert(gymId: string, id: string): Promise<{ id: string; resolvedAt: Date | null } | null>;
}

/** Efeitos colaterais observáveis (tempo real + notificação do painel). */
export interface InventoryEvents {
  publish(gymId: string, type: RealtimeEventType, payload?: Record<string, unknown>): Promise<void>;
  notify(gymId: string, type: NotificationType, title: string, message: string): Promise<void>;
}

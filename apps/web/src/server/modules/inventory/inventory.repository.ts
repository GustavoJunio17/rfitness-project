import type { StockAlertType } from "@prisma/client";
import { prisma } from "../../db";
import { createNotification } from "../notifications/notifications.service";
import { publishRealtime } from "../../realtime/publisher";
import { createInventoryService } from "./inventory.service";
import type {
  AlertRecord,
  ApplyMovementInput,
  InventoryEvents,
  InventoryRepository,
  MovementFilters,
  MovementRecord,
  VariantSnapshot,
} from "./inventory.ports";

export const prismaInventoryRepository: InventoryRepository = {
  async findVariant(gymId: string, variantId: string): Promise<VariantSnapshot | null> {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, product: { gymId } },
      select: {
        id: true,
        sku: true,
        minQuantity: true,
        currentQuantity: true,
        createdAt: true,
        product: { select: { gymId: true } },
      },
    });
    if (!variant) return null;

    return {
      id: variant.id,
      gymId: variant.product.gymId,
      sku: variant.sku,
      minQuantity: variant.minQuantity,
      currentQuantity: variant.currentQuantity,
      createdAt: variant.createdAt,
    };
  },

  async applyMovement(input: ApplyMovementInput): Promise<MovementRecord> {
    // Movimento e novo saldo na mesma transação: um `currentQuantity` que não
    // corresponda à soma dos movimentos é corrupção silenciosa de estoque.
    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          variantId: input.variantId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
          createdById: input.createdById,
        },
        include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
      }),
      prisma.productVariant.update({
        where: { id: input.variantId },
        data: { currentQuantity: input.resultingQuantity },
      }),
    ]);

    return {
      id: movement.id,
      variantId: movement.variantId,
      sku: movement.variant.sku,
      productName: movement.variant.product.name,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt,
    };
  },

  async listMovements(gymId: string, filters: MovementFilters): Promise<MovementRecord[]> {
    const movements = await prisma.stockMovement.findMany({
      where: {
        variant: { product: { gymId } },
        ...(filters.variantId ? { variantId: filters.variantId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100,
    });

    return movements.map((movement) => ({
      id: movement.id,
      variantId: movement.variantId,
      sku: movement.variant.sku,
      productName: movement.variant.product.name,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt,
    }));
  },

  async findOpenAlert(variantId: string, type: StockAlertType) {
    return prisma.stockAlert.findFirst({
      where: { variantId, type, resolvedAt: null },
      select: { id: true },
    });
  },

  async createAlert(input: { variantId: string; type: StockAlertType; message: string }) {
    return prisma.stockAlert.create({ data: input, select: { id: true } });
  },

  async resolveAlert(id: string): Promise<void> {
    await prisma.stockAlert.update({ where: { id }, data: { resolvedAt: new Date() } });
  },

  async listAlerts(gymId: string, resolved?: boolean): Promise<AlertRecord[]> {
    const alerts = await prisma.stockAlert.findMany({
      where: {
        variant: { product: { gymId } },
        ...(resolved === undefined ? {} : resolved ? { resolvedAt: { not: null } } : { resolvedAt: null }),
      },
      include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return alerts.map((alert) => ({
      id: alert.id,
      variantId: alert.variantId,
      sku: alert.variant.sku,
      productName: alert.variant.product.name,
      type: alert.type,
      message: alert.message,
      resolvedAt: alert.resolvedAt,
      createdAt: alert.createdAt,
    }));
  },

  async findAlert(gymId: string, id: string) {
    return prisma.stockAlert.findFirst({
      where: { id, variant: { product: { gymId } } },
      select: { id: true, resolvedAt: true },
    });
  },
};

export const inventoryEvents: InventoryEvents = {
  publish: publishRealtime,
  notify: createNotification,
};

export const inventoryService = createInventoryService(prismaInventoryRepository, inventoryEvents);

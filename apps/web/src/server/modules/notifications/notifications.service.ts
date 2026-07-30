import type { NotificationType } from "@prisma/client";
import { notFoundError } from "@rfitness/core";
import { prisma } from "../../db";
import { publishRealtime } from "../../realtime/publisher";

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

/**
 * Notificações do painel. `create` é best-effort porque é sempre efeito
 * colateral de outra operação (venda, pedido, alerta) que já foi confirmada.
 */
export async function createNotification(
  gymId: string,
  type: NotificationType,
  title: string,
  message: string,
): Promise<void> {
  try {
    const notification = await prisma.notification.create({ data: { gymId, type, title, message } });
    await publishRealtime(gymId, "notification.created", { notificationId: notification.id, type });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[notifications] falha ao criar notificação ${type} para ${gymId}:`, error);
  }
}

export async function listNotifications(gymId: string, unreadOnly = false): Promise<NotificationDto[]> {
  const notifications = await prisma.notification.findMany({
    where: { gymId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }));
}

export function countUnreadNotifications(gymId: string): Promise<number> {
  return prisma.notification.count({ where: { gymId, readAt: null } });
}

export async function markNotificationRead(gymId: string, id: string): Promise<void> {
  const { count } = await prisma.notification.updateMany({
    where: { id, gymId, readAt: null },
    data: { readAt: new Date() },
  });

  if (count === 0) {
    // Ou não existe, ou é de outra academia, ou já estava lida — só distinguimos
    // "não existe nesta academia" para não vazar id de outro tenant.
    const exists = await prisma.notification.findFirst({ where: { id, gymId }, select: { id: true } });
    if (!exists) throw notFoundError("Notificação não encontrada.");
  }
}

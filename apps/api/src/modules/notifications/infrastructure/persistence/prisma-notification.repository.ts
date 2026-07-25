import { Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationType } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type { Notification, NotificationRepository } from "../../domain/repositories/notification.repository";

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(gymId: string, type: NotificationType, title: string, message: string): Promise<Notification> {
    return this.prisma.notification.create({ data: { gymId, type, title, message } });
  }

  findMany(gymId: string, unreadOnly?: boolean): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { gymId, readAt: unreadOnly ? null : undefined },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(gymId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({ where: { id, gymId } });
    if (!notification) throw new NotFoundException("Notificação não encontrada.");
    await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  countUnread(gymId: string): Promise<number> {
    return this.prisma.notification.count({ where: { gymId, readAt: null } });
  }
}

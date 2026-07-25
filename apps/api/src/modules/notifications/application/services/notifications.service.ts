import { Inject, Injectable } from "@nestjs/common";
import type { NotificationType } from "@rfitness/database";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";
import {
  NOTIFICATION_REPOSITORY,
  Notification,
  NotificationRepository,
} from "../../domain/repositories/notification.repository";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    private readonly realtimeService: RealtimeService,
  ) {}

  async create(gymId: string, type: NotificationType, title: string, message: string): Promise<Notification> {
    const notification = await this.notifications.create(gymId, type, title, message);
    this.realtimeService.emitToGym(gymId, "notification.created", { notificationId: notification.id });
    return notification;
  }

  list(gymId: string, unreadOnly?: boolean): Promise<Notification[]> {
    return this.notifications.findMany(gymId, unreadOnly);
  }

  markRead(gymId: string, id: string): Promise<void> {
    return this.notifications.markRead(gymId, id);
  }

  countUnread(gymId: string): Promise<number> {
    return this.notifications.countUnread(gymId);
  }
}

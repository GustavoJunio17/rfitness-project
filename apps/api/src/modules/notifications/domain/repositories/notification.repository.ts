import type { NotificationType } from "@rfitness/database";

export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

export interface Notification {
  id: string;
  gymId: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationRepository {
  create(gymId: string, type: NotificationType, title: string, message: string): Promise<Notification>;
  findMany(gymId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markRead(gymId: string, id: string): Promise<void>;
  countUnread(gymId: string): Promise<number>;
}

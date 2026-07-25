import { Module } from "@nestjs/common";
import { NotificationsController } from "./interface/http/notifications.controller";
import { NotificationsService } from "./application/services/notifications.service";
import { NOTIFICATION_REPOSITORY } from "./domain/repositories/notification.repository";
import { PrismaNotificationRepository } from "./infrastructure/persistence/prisma-notification.repository";

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

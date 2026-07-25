import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { NotificationsService } from "../../application/services/notifications.service";

@ApiBearerAuth()
@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("unread") unread?: string) {
    return this.notificationsService.list(user.gymId, unread === "true");
  }

  @Get("unread-count")
  countUnread(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.countUnread(user.gymId);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.notificationsService.markRead(user.gymId, id);
  }
}

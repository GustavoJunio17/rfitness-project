import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { WhatsAppAdminService } from "../../application/services/whatsapp-admin.service";
import { UpdateWhatsAppSettingsDto } from "../../application/dto/update-whatsapp-settings.dto";

@ApiBearerAuth()
@ApiTags("whatsapp")
@Controller("whatsapp")
export class WhatsAppAdminController {
  constructor(private readonly whatsAppAdminService: WhatsAppAdminService) {}

  @Roles("ADMIN")
  @Patch("settings")
  async updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWhatsAppSettingsDto) {
    await this.whatsAppAdminService.setInstanceName(user.gymId, dto.whatsappInstanceName);
    return { whatsappInstanceName: dto.whatsappInstanceName };
  }

  @Roles("ADMIN", "RECEPTION")
  @Get("conversations")
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsAppAdminService.listConversations(user.gymId);
  }

  @Roles("ADMIN", "RECEPTION")
  @Get("conversations/:id")
  getConversation(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.whatsAppAdminService.getConversation(user.gymId, id);
  }
}

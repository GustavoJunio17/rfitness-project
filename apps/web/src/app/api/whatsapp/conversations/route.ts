import { defineRoute } from "@/server/http/route";
import { whatsAppService } from "@/server/modules/whatsapp/whatsapp.wiring";

export const GET = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  handler: async ({ auth }) => whatsAppService.listConversations(auth.gymId),
});

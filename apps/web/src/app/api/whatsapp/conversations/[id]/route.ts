import { notFoundError } from "@rfitness/core";
import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { whatsAppService } from "@/server/modules/whatsapp/whatsapp.wiring";

export const GET = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  params: uuidParam,
  handler: async ({ auth, params }) => {
    const conversation = await whatsAppService.getConversation(auth.gymId, params.id);
    if (!conversation) throw notFoundError("Conversa não encontrada.");
    return conversation;
  },
});

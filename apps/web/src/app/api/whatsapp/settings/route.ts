import { defineRoute } from "@/server/http/route";
import { whatsappSettingsSchema } from "@/server/http/schemas";
import { whatsAppService } from "@/server/modules/whatsapp/whatsapp.wiring";

export const PATCH = defineRoute({
  roles: ["ADMIN"],
  body: whatsappSettingsSchema,
  handler: async ({ auth, body }) => {
    await whatsAppService.updateSettings(auth.gymId, body.instanceName);
    return { ok: true, instanceName: body.instanceName };
  },
});

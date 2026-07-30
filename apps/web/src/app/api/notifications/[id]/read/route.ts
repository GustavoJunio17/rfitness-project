import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { markNotificationRead } from "@/server/modules/notifications/notifications.service";

export const PATCH = defineRoute({
  params: uuidParam,
  handler: async ({ auth, params }) => {
    await markNotificationRead(auth.gymId, params.id);
    return { ok: true };
  },
});

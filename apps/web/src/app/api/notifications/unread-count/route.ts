import { defineRoute } from "@/server/http/route";
import { countUnreadNotifications } from "@/server/modules/notifications/notifications.service";

export const GET = defineRoute({
  handler: async ({ auth }) => ({ count: await countUnreadNotifications(auth.gymId) }),
});

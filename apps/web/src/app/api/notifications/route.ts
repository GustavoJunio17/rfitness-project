import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { booleanQuery } from "@/server/http/schemas";
import { listNotifications } from "@/server/modules/notifications/notifications.service";

export const GET = defineRoute({
  query: z.object({ unread: booleanQuery }),
  handler: async ({ auth, query }) => listNotifications(auth.gymId, query.unread ?? false),
});

import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { booleanQuery } from "@/server/http/schemas";
import { inventoryService } from "@/server/modules/inventory/inventory.repository";

export const GET = defineRoute({
  query: z.object({ resolved: booleanQuery }),
  handler: async ({ auth, query }) => inventoryService.listAlerts(auth.gymId, query.resolved),
});

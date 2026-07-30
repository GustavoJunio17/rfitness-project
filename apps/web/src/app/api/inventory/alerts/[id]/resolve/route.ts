import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { inventoryService } from "@/server/modules/inventory/inventory.repository";

export const PATCH = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  handler: async ({ auth, params }) => {
    await inventoryService.resolveAlert(auth.gymId, params.id);
    return { ok: true };
  },
});

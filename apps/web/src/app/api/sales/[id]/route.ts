import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { salesService } from "@/server/modules/sales/sales.repository";

export const GET = defineRoute({
  params: uuidParam,
  handler: async ({ auth, params }) => salesService.getSale(auth.gymId, params.id),
});

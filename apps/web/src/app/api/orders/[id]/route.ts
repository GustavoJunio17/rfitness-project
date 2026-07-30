import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { ordersService } from "@/server/modules/orders/orders.repository";

export const GET = defineRoute({
  params: uuidParam,
  handler: async ({ auth, params }) => ordersService.getOrder(auth.gymId, params.id),
});

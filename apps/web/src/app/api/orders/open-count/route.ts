import { defineRoute } from "@/server/http/route";
import { ordersService } from "@/server/modules/orders/orders.repository";

export const GET = defineRoute({
  handler: async ({ auth }) => ({ count: await ordersService.getOpenCount(auth.gymId) }),
});

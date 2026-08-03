import { defineRoute } from "@/server/http/route";
import { updateOrderStatusSchema, uuidParam } from "@/server/http/schemas";
import { ordersService } from "@/server/modules/orders/orders.repository";
import { currentProfileId } from "@/server/modules/identity/identity.service";

export const PATCH = defineRoute({
  roles: ["ADMIN", "RECEPTION", "STOCKIST"],
  params: uuidParam,
  body: updateOrderStatusSchema,
  handler: async ({ auth, params, body }) =>
    ordersService.updateStatus(
      auth.gymId,
      params.id,
      body.status,
      currentProfileId(auth),
    ),
});

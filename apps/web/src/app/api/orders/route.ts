import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { createOrderSchema, limitQuery, orderStatusSchema } from "@/server/http/schemas";
import { ordersService } from "@/server/modules/orders/orders.repository";

export const GET = defineRoute({
  query: z.object({ status: orderStatusSchema.optional(), limit: limitQuery }),
  handler: async ({ auth, query }) => ordersService.listOrders(auth.gymId, query),
});

export const POST = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  body: createOrderSchema,
  handler: async ({ auth, body }) => ordersService.createOrder(auth.gymId, body),
});

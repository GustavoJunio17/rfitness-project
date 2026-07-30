import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { createSaleSchema, limitQuery } from "@/server/http/schemas";
import { salesService } from "@/server/modules/sales/sales.repository";
import { resolveUserId } from "@/server/modules/identity/identity.service";

export const GET = defineRoute({
  query: z.object({
    employeeId: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: limitQuery,
  }),
  handler: async ({ auth, query }) =>
    salesService.listSales(auth.gymId, {
      employeeId: query.employeeId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
    }),
});

export const POST = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  body: createSaleSchema,
  handler: async ({ auth, body }) =>
    salesService.createSale(auth.gymId, await resolveUserId(auth.authUserId, auth.gymId), body),
});

import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { limitQuery, movementTypeSchema, registerMovementSchema } from "@/server/http/schemas";
import { inventoryService } from "@/server/modules/inventory/inventory.repository";
import { resolveUserId } from "@/server/modules/identity/identity.service";

export const GET = defineRoute({
  query: z.object({
    variantId: z.string().uuid().optional(),
    type: movementTypeSchema.optional(),
    limit: limitQuery,
  }),
  handler: async ({ auth, query }) => inventoryService.listMovements(auth.gymId, query),
});

export const POST = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  body: registerMovementSchema,
  handler: async ({ auth, body }) =>
    inventoryService.registerMovement(auth.gymId, body, await resolveUserId(auth.authUserId, auth.gymId)),
});

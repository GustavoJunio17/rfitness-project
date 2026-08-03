import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { createProductSchema, productStatusSchema } from "@/server/http/schemas";
import { createProduct, listProducts } from "@/server/modules/catalog/catalog.service";
import { currentProfileId } from "@/server/modules/identity/identity.service";

export const GET = defineRoute({
  query: z.object({
    search: z.string().trim().max(120).optional(),
    categoryId: z.string().uuid().optional(),
    status: productStatusSchema.optional(),
  }),
  handler: async ({ auth, query }) => listProducts(auth.gymId, query),
});

export const POST = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  body: createProductSchema,
  handler: async ({ auth, body }) =>
    createProduct(auth.gymId, body, currentProfileId(auth)),
});

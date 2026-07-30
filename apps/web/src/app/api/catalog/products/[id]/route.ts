import { defineRoute } from "@/server/http/route";
import { updateProductSchema, uuidParam } from "@/server/http/schemas";
import { deleteProduct, getProduct, updateProduct } from "@/server/modules/catalog/catalog.service";

export const GET = defineRoute({
  params: uuidParam,
  handler: async ({ auth, params }) => getProduct(auth.gymId, params.id),
});

export const PUT = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  body: updateProductSchema,
  handler: async ({ auth, params, body }) => updateProduct(auth.gymId, params.id, body),
});

export const DELETE = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  handler: async ({ auth, params }) => deleteProduct(auth.gymId, params.id),
});

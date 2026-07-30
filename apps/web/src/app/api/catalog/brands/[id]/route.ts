import { defineRoute } from "@/server/http/route";
import { nameSchema, uuidParam } from "@/server/http/schemas";
import { deleteBrand, updateBrand } from "@/server/modules/catalog/reference-data.service";

export const PUT = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  body: nameSchema,
  handler: async ({ auth, params, body }) => updateBrand(auth.gymId, params.id, body.name),
});

export const DELETE = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  handler: async ({ auth, params }) => {
    await deleteBrand(auth.gymId, params.id);
    return { ok: true };
  },
});

import { defineRoute } from "@/server/http/route";
import { updateVariantSchema, uuidParam } from "@/server/http/schemas";
import { updateVariant } from "@/server/modules/catalog/catalog.service";

export const PUT = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  body: updateVariantSchema,
  handler: async ({ auth, params, body }) => updateVariant(auth.gymId, params.id, body),
});

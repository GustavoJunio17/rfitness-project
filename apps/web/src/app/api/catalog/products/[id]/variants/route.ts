import { defineRoute } from "@/server/http/route";
import { uuidParam, variantWriteSchema } from "@/server/http/schemas";
import { createVariant } from "@/server/modules/catalog/catalog.service";
import { currentProfileId } from "@/server/modules/identity/identity.service";

export const POST = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  body: variantWriteSchema,
  handler: async ({ auth, params, body }) =>
    createVariant(auth.gymId, params.id, body, currentProfileId(auth)),
});

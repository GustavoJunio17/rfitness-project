import { requestMeta } from "@/server/audit/audit-log";
import { defineRoute } from "@/server/http/route";
import { updateGymSchema, uuidParam } from "@/server/http/schemas";
import { updateGym } from "@/server/modules/identity/identity.service";

export const PATCH = defineRoute({
  scope: "any",
  params: uuidParam,
  body: updateGymSchema,
  handler: async ({ auth, params, body, request }) =>
    updateGym(auth, params.id, body, requestMeta(request)),
});

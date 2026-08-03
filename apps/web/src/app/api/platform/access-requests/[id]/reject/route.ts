import { defineRoute } from "@/server/http/route";
import { rejectAccessRequestSchema, uuidParam } from "@/server/http/schemas";
import { rejectAccessRequest } from "@/server/modules/platform/platform.service";

export const POST = defineRoute({
  scope: "platform",
  params: uuidParam,
  body: rejectAccessRequestSchema,
  handler: async ({ auth, params, body }) => rejectAccessRequest(auth, params.id, body.reason),
});

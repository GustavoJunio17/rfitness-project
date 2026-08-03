import { defineRoute } from "@/server/http/route";
import { accountIdParam } from "@/server/http/schemas";
import { revokeGymAccess } from "@/server/modules/platform/platform.service";

export const DELETE = defineRoute({
  scope: "platform",
  params: accountIdParam,
  handler: async ({ auth, params }) => {
    await revokeGymAccess(auth, params.id, params.accountId);
  },
});

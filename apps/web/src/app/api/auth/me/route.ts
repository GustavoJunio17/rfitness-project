import { defineRoute } from "@/server/http/route";
import { getCurrentUser } from "@/server/modules/identity/identity.service";

export const GET = defineRoute({
  handler: async ({ auth }) => getCurrentUser(auth),
});

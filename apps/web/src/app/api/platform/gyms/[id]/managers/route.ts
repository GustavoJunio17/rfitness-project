import { defineRoute } from "@/server/http/route";
import { gymAccessSchema, uuidParam } from "@/server/http/schemas";
import { grantGymAccess } from "@/server/modules/platform/platform.service";

/** Dá a um gestor permissão de gerir esta academia, sem torná-lo dono. */
export const POST = defineRoute({
  scope: "platform",
  params: uuidParam,
  body: gymAccessSchema,
  handler: async ({ auth, params, body }) => {
    await grantGymAccess(auth, params.id, body.accountId);
  },
});

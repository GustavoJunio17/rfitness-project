import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { approveAccessRequest } from "@/server/modules/platform/platform.service";

/** Libera o cadastro: a partir daí o gestor cadastra as academias dele. */
export const POST = defineRoute({
  scope: "platform",
  params: uuidParam,
  handler: async ({ auth, params }) => approveAccessRequest(auth, params.id),
});

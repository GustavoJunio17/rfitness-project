import { requestMeta } from "@/server/audit/audit-log";
import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { approveAccessRequest } from "@/server/modules/platform/platform.service";

/**
 * Aprovar cria a conta do gestor e a primeira academia dele. A resposta traz a
 * senha provisória — é a única vez que ela aparece.
 */
export const POST = defineRoute({
  scope: "platform",
  params: uuidParam,
  handler: async ({ auth, params, request }) =>
    approveAccessRequest(auth, params.id, requestMeta(request)),
});

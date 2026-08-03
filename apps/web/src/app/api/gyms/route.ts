import { requestMeta } from "@/server/audit/audit-log";
import { defineRoute } from "@/server/http/route";
import { createGymSchema } from "@/server/http/schemas";
import { createGym, listMyGyms } from "@/server/modules/identity/identity.service";

/**
 * A rede do gestor. `scope: "any"` porque estas rotas são justamente as de quem
 * ainda não tem academia ativa — exigir uma seria trancar o gestor do lado de
 * fora da tela onde ele criaria a primeira.
 */
export const GET = defineRoute({
  scope: "any",
  handler: async ({ auth }) => listMyGyms(auth),
});

export const POST = defineRoute({
  scope: "any",
  body: createGymSchema,
  handler: async ({ auth, body, request }) => createGym(auth, body, requestMeta(request)),
});

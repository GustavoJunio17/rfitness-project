import { defineRoute } from "@/server/http/route";
import { getCurrentUser } from "@/server/modules/identity/identity.service";

/**
 * `scope: "any"` de propósito: é a rota que diz ao cliente que ele **não** tem
 * academia. Exigir uma aqui esconderia essa resposta atrás de um erro.
 */
export const GET = defineRoute({
  scope: "any",
  handler: async ({ auth }) => getCurrentUser(auth),
});

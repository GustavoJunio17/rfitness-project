import { defineRoute } from "@/server/http/route";
import { changePasswordSchema } from "@/server/http/schemas";
import { changeOwnPassword } from "@/server/modules/identity/identity.service";

/**
 * Troca da própria senha. Existe porque o gestor entra com uma senha provisória
 * gerada na aprovação — sem esta rota, ela seria definitiva.
 */
export const POST = defineRoute({
  scope: "any",
  body: changePasswordSchema,
  handler: async ({ auth, body }) => {
    await changeOwnPassword(auth, body);
  },
});

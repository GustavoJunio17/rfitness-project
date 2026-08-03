import { defineRoute } from "@/server/http/route";
import { setPasswordSchema, uuidParam } from "@/server/http/schemas";
import { setManagerAccountPassword } from "@/server/modules/platform/platform.service";

/** Redefine a senha do gestor — ele pode trocá-la depois em Conta. */
export const PUT = defineRoute({
  scope: "platform",
  params: uuidParam,
  body: setPasswordSchema,
  handler: async ({ auth, params, body }) => {
    await setManagerAccountPassword(auth, params.id, body.password);
  },
});

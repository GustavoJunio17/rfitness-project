import { defineRoute } from "@/server/http/route";
import { signUpSchema } from "@/server/http/schemas";
import { signUp } from "@/server/modules/platform/platform.service";

/**
 * Cadastro público de gestor. Cria a conta — a pessoa já consegue entrar — mas
 * a academia só nasce quando a administração da RFitness aprovar.
 */
export const POST = defineRoute({
  public: true,
  body: signUpSchema,
  handler: async ({ body }) => signUp(body),
});

import { defineRoute } from "@/server/http/route";
import { accessRequestSchema } from "@/server/http/schemas";
import { submitAccessRequest } from "@/server/modules/platform/platform.service";

/**
 * Pedido de acesso à plataforma. É a única porta pública de entrada — não cria
 * conta nem academia, só registra o interesse para a RFitness aprovar.
 */
export const POST = defineRoute({
  public: true,
  body: accessRequestSchema,
  handler: async ({ body }) => submitAccessRequest(body),
});

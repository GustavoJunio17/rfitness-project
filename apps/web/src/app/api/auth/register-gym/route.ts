import { requestMeta } from "@/server/audit/audit-log";
import { defineRoute } from "@/server/http/route";
import { registerGymSchema } from "@/server/http/schemas";
import { registerGym } from "@/server/modules/identity/identity.service";

/**
 * Cadastro de academia. Público por definição — é o onboarding. O login em si
 * acontece no cliente, direto contra o Supabase Auth.
 */
export const POST = defineRoute({
  public: true,
  body: registerGymSchema,
  handler: async ({ body, request }) => registerGym(body, requestMeta(request)),
});

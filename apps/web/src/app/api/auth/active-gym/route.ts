import { cookies } from "next/headers";
import { ACTIVE_GYM_COOKIE } from "@/server/auth/identity";
import { defineRoute } from "@/server/http/route";
import { activeGymSchema } from "@/server/http/schemas";
import { assertMembership } from "@/server/modules/identity/identity.service";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Troca a academia ativa da sessão.
 *
 * O destino é guardado num cookie, não no JWT: trocar de unidade não pode exigir
 * reemissão de token nem novo login. O cookie é só uma preferência — quem decide
 * se ela vale é `getAuthContext`, que a confronta com os vínculos reais a cada
 * request. Por isso `httpOnly`: nenhum script precisa lê-lo.
 */
export const POST = defineRoute({
  scope: "any",
  body: activeGymSchema,
  handler: async ({ auth, body }) => {
    const membership = assertMembership(auth, body.gymId);

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_GYM_COOKIE, membership.gymId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR_IN_SECONDS,
    });

    return membership;
  },
});

import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { generateVariantQrCode } from "@/server/modules/catalog/catalog.service";

export const GET = defineRoute({
  params: uuidParam,
  handler: async ({ auth, params }) => generateVariantQrCode(auth.gymId, params.id),
});

import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { findVariantByBarcode } from "@/server/modules/catalog/catalog.service";

export const GET = defineRoute({
  params: z.object({ code: z.string().trim().min(4).max(60) }),
  handler: async ({ auth, params }) => findVariantByBarcode(auth.gymId, params.code),
});

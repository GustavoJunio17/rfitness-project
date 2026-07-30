import { defineRoute } from "@/server/http/route";
import { nameSchema } from "@/server/http/schemas";
import { createBrand, listBrands } from "@/server/modules/catalog/reference-data.service";

export const GET = defineRoute({ handler: async ({ auth }) => listBrands(auth.gymId) });

export const POST = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  body: nameSchema,
  handler: async ({ auth, body }) => createBrand(auth.gymId, body.name),
});

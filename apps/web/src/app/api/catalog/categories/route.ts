import { defineRoute } from "@/server/http/route";
import { nameSchema } from "@/server/http/schemas";
import { createCategory, listCategories } from "@/server/modules/catalog/reference-data.service";

export const GET = defineRoute({ handler: async ({ auth }) => listCategories(auth.gymId) });

export const POST = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  body: nameSchema,
  handler: async ({ auth, body }) => createCategory(auth.gymId, body.name),
});

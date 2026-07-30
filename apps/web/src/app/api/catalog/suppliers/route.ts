import { defineRoute } from "@/server/http/route";
import { supplierSchema } from "@/server/http/schemas";
import { createSupplier, listSuppliers } from "@/server/modules/catalog/reference-data.service";

export const GET = defineRoute({ handler: async ({ auth }) => listSuppliers(auth.gymId) });

export const POST = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  body: supplierSchema,
  handler: async ({ auth, body }) => createSupplier(auth.gymId, body),
});

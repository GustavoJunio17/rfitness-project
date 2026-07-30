import { defineRoute } from "@/server/http/route";
import { supplierSchema, uuidParam } from "@/server/http/schemas";
import { deleteSupplier, updateSupplier } from "@/server/modules/catalog/reference-data.service";

export const PUT = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  body: supplierSchema.partial(),
  handler: async ({ auth, params, body }) => updateSupplier(auth.gymId, params.id, body),
});

export const DELETE = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  handler: async ({ auth, params }) => {
    await deleteSupplier(auth.gymId, params.id);
    return { ok: true };
  },
});

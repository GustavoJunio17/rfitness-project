import { defineRoute } from "@/server/http/route";
import { planSchema, uuidParam } from "@/server/http/schemas";
import { deletePlan, updatePlan } from "@/server/modules/students/plans.service";

export const PUT = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  params: uuidParam,
  body: planSchema.partial(),
  handler: async ({ auth, params, body }) => updatePlan(auth.gymId, params.id, body),
});

export const DELETE = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  params: uuidParam,
  handler: async ({ auth, params }) => deletePlan(auth.gymId, params.id),
});

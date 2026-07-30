import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { booleanQuery, planSchema } from "@/server/http/schemas";
import { createPlan, listPlans } from "@/server/modules/students/plans.service";

export const GET = defineRoute({
  query: z.object({ activeOnly: booleanQuery }),
  handler: async ({ auth, query }) => listPlans(auth.gymId, query.activeOnly ?? false),
});

export const POST = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  body: planSchema,
  handler: async ({ auth, body }) => createPlan(auth.gymId, body),
});

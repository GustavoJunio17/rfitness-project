import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { daysQuery } from "@/server/http/schemas";
import { getSalesHeatmap } from "@/server/modules/finance/analytics.service";

export const GET = defineRoute({
  roles: ["ADMIN", "FINANCE"],
  query: z.object({ days: daysQuery }),
  handler: async ({ auth, query }) => getSalesHeatmap(auth.gymId, query.days ?? 30),
});

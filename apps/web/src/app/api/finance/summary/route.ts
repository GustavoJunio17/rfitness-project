import { defineRoute } from "@/server/http/route";
import { getFinanceSummary } from "@/server/modules/finance/analytics.service";

export const GET = defineRoute({
  roles: ["ADMIN", "FINANCE"],
  handler: async ({ auth }) => getFinanceSummary(auth.gymId),
});

import { defineRoute } from "@/server/http/route";
import { getPaymentBreakdown } from "@/server/modules/finance/analytics.service";

export const GET = defineRoute({
  roles: ["ADMIN", "FINANCE"],
  handler: async ({ auth }) => getPaymentBreakdown(auth.gymId),
});

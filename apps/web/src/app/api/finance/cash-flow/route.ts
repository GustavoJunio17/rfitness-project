import { defineRoute } from "@/server/http/route";
import { cashFlowEntrySchema } from "@/server/http/schemas";
import { createCashFlowEntry, listCashFlow } from "@/server/modules/finance/cash-flow.service";

export const GET = defineRoute({
  roles: ["ADMIN", "FINANCE"],
  handler: async ({ auth }) => listCashFlow(auth.gymId),
});

export const POST = defineRoute({
  roles: ["ADMIN", "FINANCE"],
  body: cashFlowEntrySchema,
  handler: async ({ auth, body }) => createCashFlowEntry(auth.gymId, body),
});

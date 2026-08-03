import { defineRoute } from "@/server/http/route";
import { createManagerAccountSchema, managerAccountQuery } from "@/server/http/schemas";
import { createManagerAccount, listManagerAccounts } from "@/server/modules/platform/platform.service";

export const GET = defineRoute({
  scope: "platform",
  query: managerAccountQuery,
  handler: async ({ query }) => listManagerAccounts(query),
});

export const POST = defineRoute({
  scope: "platform",
  body: createManagerAccountSchema,
  handler: async ({ auth, body }) => createManagerAccount(auth, body),
});

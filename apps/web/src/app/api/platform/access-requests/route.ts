import { defineRoute } from "@/server/http/route";
import { accessRequestQuery } from "@/server/http/schemas";
import { listAccessRequests } from "@/server/modules/platform/platform.service";

export const GET = defineRoute({
  scope: "platform",
  query: accessRequestQuery,
  handler: async ({ query }) => listAccessRequests(query.status),
});

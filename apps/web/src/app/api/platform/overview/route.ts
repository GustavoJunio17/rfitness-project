import { defineRoute } from "@/server/http/route";
import { getPlatformOverview } from "@/server/modules/platform/platform.service";

export const GET = defineRoute({
  scope: "platform",
  handler: async () => getPlatformOverview(),
});

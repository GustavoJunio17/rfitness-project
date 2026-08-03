import { defineRoute } from "@/server/http/route";
import { listGymOptions } from "@/server/modules/platform/platform.service";

/** Lista enxuta para seletores — sem contagens nem gestores. */
export const GET = defineRoute({
  scope: "platform",
  handler: async () => listGymOptions(),
});

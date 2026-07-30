import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { limitQuery } from "@/server/http/schemas";
import { getTopProducts } from "@/server/modules/finance/analytics.service";

export const GET = defineRoute({
  roles: ["ADMIN", "FINANCE"],
  query: z.object({ limit: limitQuery, order: z.enum(["asc", "desc"]).optional() }),
  handler: async ({ auth, query }) => getTopProducts(auth.gymId, query.limit ?? 5, query.order ?? "desc"),
});

import { defineRoute } from "@/server/http/route";

export const GET = defineRoute({
  public: true,
  handler: async () => ({ status: "ok", timestamp: new Date().toISOString() }),
});

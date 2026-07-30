import { assertCronRequest } from "@/server/http/cron";
import { defineRoute } from "@/server/http/route";
import { sweepStockAlerts } from "@/server/modules/inventory/stock-alert-sweep";
import { pruneRealtimeEvents } from "@/server/realtime/publisher";

/** Vercel Cron — 09:00 UTC (06:00 America/Sao_Paulo). */
export const GET = defineRoute({
  public: true,
  handler: async ({ request }) => {
    assertCronRequest(request);
    const alerts = await sweepStockAlerts();
    const prunedEvents = await pruneRealtimeEvents();
    return { ...alerts, prunedEvents };
  },
});

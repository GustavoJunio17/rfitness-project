import { assertCronRequest } from "@/server/http/cron";
import { defineRoute } from "@/server/http/route";
import { runWhatsAppFollowUp } from "@/server/modules/whatsapp/follow-up";

/** Vercel Cron — 13:00 UTC (10:00 America/Sao_Paulo). */
export const GET = defineRoute({
  public: true,
  handler: async ({ request }) => {
    assertCronRequest(request);
    return runWhatsAppFollowUp();
  },
});

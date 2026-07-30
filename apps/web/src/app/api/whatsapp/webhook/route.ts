import { z } from "zod";
import { unauthorizedError } from "@rfitness/core";
import { getEnv } from "@/server/env";
import { defineRoute } from "@/server/http/route";
import { whatsAppService } from "@/server/modules/whatsapp/whatsapp.wiring";

/**
 * Webhook de mensagens recebidas da Evolution API.
 *
 * Configure na instância: `https://<host>/api/whatsapp/webhook?token=<EVOLUTION_API_KEY>`.
 * O token na query é a autenticação desta rota pública — a Evolution API não
 * assina os webhooks que envia.
 */
const bodySchema = z.object({
  instance: z.string().optional(),
  data: z
    .object({
      key: z.object({ remoteJid: z.string().optional(), fromMe: z.boolean().optional() }).optional(),
      message: z
        .object({
          conversation: z.string().optional(),
          extendedTextMessage: z.object({ text: z.string().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const POST = defineRoute({
  public: true,
  query: z.object({ token: z.string().optional() }),
  body: bodySchema,
  handler: async ({ query, body }) => {
    const expected = getEnv().EVOLUTION_API_KEY;
    if (!expected || query.token !== expected) {
      throw unauthorizedError("Token de webhook inválido.");
    }

    const instanceName = body.instance;
    const remoteJid = body.data?.key?.remoteJid;
    const text = body.data?.message?.conversation ?? body.data?.message?.extendedTextMessage?.text;

    // Mensagem enviada por nós (`fromMe`) precisa ser ignorada, senão o agente
    // responde às próprias respostas em loop.
    if (!instanceName || !remoteJid || body.data?.key?.fromMe || !text) {
      return { status: "ignored" };
    }

    const phone = remoteJid.split("@")[0] ?? "";
    if (!phone) return { status: "ignored" };

    try {
      await whatsAppService.handleIncomingMessage(instanceName, phone, text);
    } catch (error) {
      // Erro devolvido faria a Evolution API reenviar o webhook em loop.
      // eslint-disable-next-line no-console
      console.error("[whatsapp-webhook] falha ao processar mensagem:", error);
    }

    return { status: "ok" };
  },
});

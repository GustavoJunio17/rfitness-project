import { getEnv } from "../../env";
import type { WhatsAppGateway } from "./whatsapp.ports";

/**
 * Adapter da Evolution API (gateway self-hosted de WhatsApp).
 *
 * Falha de envio não é silenciada mas também não derruba o fluxo do chamador —
 * quem chama já gravou a mensagem no banco e trata o erro como best-effort.
 */
export const evolutionGateway: WhatsAppGateway = {
  async sendMessage(instanceName: string, phone: string, text: string): Promise<void> {
    const env = getEnv();
    const url = `${env.EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendText/${instanceName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phone, text }),
      // Serverless: sem timeout explícito a função pode ficar presa até o limite
      // da plataforma se a Evolution API não responder.
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Evolution API respondeu ${response.status}: ${detail.slice(0, 200)}`);
    }
  },
};

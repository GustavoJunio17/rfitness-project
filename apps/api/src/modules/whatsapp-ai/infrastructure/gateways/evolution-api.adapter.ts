import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WhatsAppGateway } from "../../domain/gateways/whatsapp.gateway";

/**
 * Adapter for Evolution API (self-hosted WhatsApp gateway, https://doc.evolution-api.com).
 * Not exercised in this environment (no Evolution API instance running here) — verify
 * against a real instance before relying on this in production.
 */
@Injectable()
export class EvolutionApiAdapter implements WhatsAppGateway {
  private readonly logger = new Logger(EvolutionApiAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(instanceName: string, phone: string, text: string): Promise<void> {
    const baseUrl = this.configService.get<string>("whatsapp.evolutionApiUrl");
    const apiKey = this.configService.get<string>("whatsapp.evolutionApiKey");

    const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey ?? "",
      },
      body: JSON.stringify({ number: phone, text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      this.logger.error(`Falha ao enviar mensagem via Evolution API (${response.status}): ${body}`);
      throw new Error(`Evolution API respondeu ${response.status}`);
    }
  }
}

import { Body, Controller, Logger, Post, Query, UnauthorizedException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../../../shared/decorators/public.decorator";
import { WhatsAppAgentService } from "../../application/services/whatsapp-agent.service";

interface EvolutionWebhookBody {
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: { conversation?: string; extendedTextMessage?: { text?: string } };
  };
}

/**
 * Receives inbound WhatsApp messages forwarded by a self-hosted Evolution API
 * instance. Configure the instance's webhook URL as
 * `https://<api-host>/api/whatsapp/webhook?token=<EVOLUTION_API_KEY>` — the
 * token in the query string is how this public endpoint authenticates the
 * caller (Evolution API does not sign outgoing webhooks itself).
 *
 * Not exercised in this environment — no Evolution API instance is running
 * here to send a real webhook call. Verify against a real instance.
 */
@ApiExcludeController()
@Controller("whatsapp")
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsAppAgentService: WhatsAppAgentService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post("webhook")
  async receiveWebhook(@Query("token") token: string | undefined, @Body() body: EvolutionWebhookBody) {
    const expectedToken = this.configService.get<string>("whatsapp.webhookSharedSecret");
    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException("Token de webhook inválido.");
    }

    const instanceName = body.instance;
    const remoteJid = body.data?.key?.remoteJid;
    const isFromMe = body.data?.key?.fromMe;
    const text = body.data?.message?.conversation ?? body.data?.message?.extendedTextMessage?.text;

    if (!instanceName || !remoteJid || isFromMe || !text) {
      return { status: "ignored" };
    }

    const phone = remoteJid.split("@")[0];

    try {
      await this.whatsAppAgentService.handleIncomingMessage(instanceName, phone, text);
    } catch (error) {
      this.logger.error(`Falha ao processar mensagem do WhatsApp: ${error}`);
    }

    return { status: "ok" };
  }
}

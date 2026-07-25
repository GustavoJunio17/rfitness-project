import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { StudentsModule } from "../students/students.module";
import { OrdersModule } from "../orders/orders.module";
import { WhatsAppAdminController } from "./interface/http/whatsapp-admin.controller";
import { WhatsAppWebhookController } from "./interface/http/whatsapp-webhook.controller";
import { FollowUpScheduler } from "./interface/jobs/follow-up.scheduler";
import { ClaudeAgentService } from "./application/services/claude-agent.service";
import { WhatsAppAgentService } from "./application/services/whatsapp-agent.service";
import { WhatsAppAdminService } from "./application/services/whatsapp-admin.service";
import { CONVERSATION_REPOSITORY } from "./domain/repositories/conversation.repository";
import { PrismaConversationRepository } from "./infrastructure/persistence/prisma-conversation.repository";
import { AGENT_ACTION_REPOSITORY } from "./domain/repositories/agent-action.repository";
import { PrismaAgentActionRepository } from "./infrastructure/persistence/prisma-agent-action.repository";
import { WHATSAPP_GATEWAY } from "./domain/gateways/whatsapp.gateway";
import { EvolutionApiAdapter } from "./infrastructure/gateways/evolution-api.adapter";

@Module({
  imports: [CatalogModule, StudentsModule, OrdersModule],
  controllers: [WhatsAppAdminController, WhatsAppWebhookController],
  providers: [
    ClaudeAgentService,
    WhatsAppAgentService,
    WhatsAppAdminService,
    FollowUpScheduler,
    { provide: CONVERSATION_REPOSITORY, useClass: PrismaConversationRepository },
    { provide: AGENT_ACTION_REPOSITORY, useClass: PrismaAgentActionRepository },
    { provide: WHATSAPP_GATEWAY, useClass: EvolutionApiAdapter },
  ],
  exports: [WhatsAppAgentService],
})
export class WhatsAppAiModule {}

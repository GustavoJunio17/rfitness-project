import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CONVERSATION_REPOSITORY,
  ConversationDetail,
  ConversationRepository,
  ConversationSummary,
} from "../../domain/repositories/conversation.repository";

@Injectable()
export class WhatsAppAdminService {
  constructor(@Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository) {}

  setInstanceName(gymId: string, instanceName: string): Promise<void> {
    return this.conversations.setInstanceName(gymId, instanceName);
  }

  listConversations(gymId: string): Promise<ConversationSummary[]> {
    return this.conversations.listConversations(gymId);
  }

  async getConversation(gymId: string, id: string): Promise<ConversationDetail> {
    const conversation = await this.conversations.getConversationDetail(gymId, id);
    if (!conversation) throw new NotFoundException("Conversa não encontrada.");
    return conversation;
  }
}

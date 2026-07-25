export const CONVERSATION_REPOSITORY = Symbol("CONVERSATION_REPOSITORY");

export type MessageDirection = "INBOUND" | "OUTBOUND";

export interface GymByInstance {
  id: string;
  name: string;
  whatsappInstanceName: string;
}

export interface ConversationMessage {
  id: string;
  direction: MessageDirection;
  content: string;
  handledByAi: boolean;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  gymId: string;
  studentId: string | null;
  phone: string;
}

export interface ConversationSummary extends Conversation {
  studentName: string | null;
  lastMessage: ConversationMessage | null;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}

export interface GymWhatsAppSettings {
  name: string;
  whatsappInstanceName: string | null;
}

export interface ConversationRepository {
  findGymByInstanceName(instanceName: string): Promise<GymByInstance | null>;
  findGymSettingsById(gymId: string): Promise<GymWhatsAppSettings | null>;
  setInstanceName(gymId: string, instanceName: string): Promise<void>;
  findOrCreateByPhone(gymId: string, phone: string): Promise<Conversation>;
  appendMessage(
    conversationId: string,
    direction: MessageDirection,
    content: string,
    handledByAi: boolean,
  ): Promise<ConversationMessage>;
  getRecentMessages(conversationId: string, limit: number): Promise<ConversationMessage[]>;
  linkStudent(conversationId: string, studentId: string): Promise<void>;
  listConversations(gymId: string): Promise<ConversationSummary[]>;
  getConversationDetail(gymId: string, id: string): Promise<ConversationDetail | null>;
}

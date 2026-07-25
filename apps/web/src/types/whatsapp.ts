export type MessageDirection = "INBOUND" | "OUTBOUND";

export interface ConversationMessage {
  id: string;
  direction: MessageDirection;
  content: string;
  handledByAi: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  gymId: string;
  studentId: string | null;
  studentName: string | null;
  phone: string;
  lastMessage: ConversationMessage | null;
}

export interface ConversationDetail {
  id: string;
  gymId: string;
  studentId: string | null;
  phone: string;
  messages: ConversationMessage[];
}

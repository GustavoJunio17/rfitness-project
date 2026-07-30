export type MessageDirection = "INBOUND" | "OUTBOUND";

export interface ConversationMessage {
  id: string;
  direction: MessageDirection;
  content: string;
  /** true = texto gerado pelo agente; false = template ou humano. */
  handledByAi: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  studentId: string | null;
  studentName: string | null;
  phone: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadInbound: number;
}

export interface ConversationDetail {
  id: string;
  studentId: string | null;
  studentName: string | null;
  phone: string;
  messages: ConversationMessage[];
}

import type { DeliveryType, MessageDirection, PaymentMethodType } from "@prisma/client";
import type { RealtimeEventType } from "../../realtime/signal";

export interface GymWhatsAppSettings {
  id: string;
  name: string;
  whatsappInstanceName: string | null;
}

export interface ConversationRow {
  id: string;
  studentId: string | null;
  phone: string;
}

export interface ConversationSummary extends ConversationRow {
  studentName: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadInbound: number;
}

export interface ConversationDetail extends ConversationRow {
  studentName: string | null;
  messages: { id: string; direction: MessageDirection; content: string; handledByAi: boolean; createdAt: Date }[];
}

export interface ConversationRepository {
  findGymByInstanceName(instanceName: string): Promise<GymWhatsAppSettings | null>;
  findGymById(gymId: string): Promise<GymWhatsAppSettings | null>;
  findOrCreateByPhone(gymId: string, phone: string): Promise<ConversationRow>;
  appendMessage(
    conversationId: string,
    direction: MessageDirection,
    content: string,
    handledByAi: boolean,
  ): Promise<void>;
  linkStudent(conversationId: string, studentId: string): Promise<void>;
  getRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<{ direction: MessageDirection; content: string }[]>;
  listConversations(gymId: string): Promise<ConversationSummary[]>;
  getConversation(gymId: string, id: string): Promise<ConversationDetail | null>;
  updateInstanceName(gymId: string, instanceName: string | null): Promise<void>;
  logAgentAction(entry: {
    gymId: string;
    action: string;
    input?: unknown;
    output?: unknown;
  }): Promise<void>;
}

export interface WhatsAppGateway {
  sendMessage(instanceName: string, phone: string, text: string): Promise<void>;
}

export interface ProductMatch {
  productName: string;
  sku: string;
  variantId: string;
  flavor?: string | null;
  weight?: string | null;
  salePrice: number;
  quantity: number;
}

export interface StudentSnapshot {
  id: string;
  name: string;
  whatsapp?: string | null;
  status?: string;
  subscriptions?: { planName: string; dueDate: Date; cancelledAt: Date | null }[];
}

/** Dependências de outros módulos, injetadas para não acoplar (e não ciclar). */
export interface WhatsAppSideEffects {
  publish(gymId: string, type: RealtimeEventType, payload?: Record<string, unknown>): Promise<void>;
  findStudentByPhone(gymId: string, phone: string): Promise<StudentSnapshot | null>;
  getStudent(gymId: string, studentId: string): Promise<StudentSnapshot | null>;
  searchProducts(gymId: string, query: string): Promise<ProductMatch[]>;
  createOrder(
    gymId: string,
    input: {
      studentId: string | null;
      customerName: string;
      customerPhone: string;
      address?: string | null;
      deliveryType: DeliveryType;
      paymentMethod: PaymentMethodType;
      items: { variantId: string; quantity: number }[];
    },
  ): Promise<{ orderNumber: number; totalAmount: number; status: string }>;
}

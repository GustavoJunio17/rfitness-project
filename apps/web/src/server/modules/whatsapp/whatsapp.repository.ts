import type { MessageDirection, Prisma } from "@prisma/client";
import { prisma } from "../../db";
import type {
  ConversationDetail,
  ConversationRepository,
  ConversationRow,
  ConversationSummary,
  GymWhatsAppSettings,
} from "./whatsapp.ports";

export const prismaConversationRepository: ConversationRepository = {
  async findGymByInstanceName(instanceName: string): Promise<GymWhatsAppSettings | null> {
    return prisma.gym.findUnique({
      where: { whatsappInstanceName: instanceName },
      select: { id: true, name: true, whatsappInstanceName: true },
    });
  },

  async findGymById(gymId: string): Promise<GymWhatsAppSettings | null> {
    return prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, name: true, whatsappInstanceName: true },
    });
  },

  async findOrCreateByPhone(gymId: string, phone: string): Promise<ConversationRow> {
    const conversation = await prisma.conversation.upsert({
      where: { gymId_phone: { gymId, phone } },
      update: {},
      create: { gymId, phone },
      select: { id: true, studentId: true, phone: true },
    });
    return conversation;
  },

  async appendMessage(
    conversationId: string,
    direction: MessageDirection,
    content: string,
    handledByAi: boolean,
  ): Promise<void> {
    await prisma.$transaction([
      prisma.message.create({ data: { conversationId, direction, content, handledByAi } }),
      // `updatedAt` ordena a lista de conversas do painel pela atividade real.
      prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
  },

  async linkStudent(conversationId: string, studentId: string): Promise<void> {
    await prisma.conversation.update({ where: { id: conversationId }, data: { studentId } });
  },

  async getRecentMessages(conversationId: string, limit: number) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { direction: true, content: true },
    });
    return messages.reverse();
  },

  async listConversations(gymId: string): Promise<ConversationSummary[]> {
    const conversations = await prisma.conversation.findMany({
      where: { gymId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        student: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      studentId: conversation.studentId,
      phone: conversation.phone,
      studentName: conversation.student?.name ?? null,
      lastMessage: conversation.messages[0]?.content ?? null,
      lastMessageAt: conversation.messages[0]?.createdAt ?? null,
      unreadInbound: 0,
    }));
  },

  async getConversation(gymId: string, id: string): Promise<ConversationDetail | null> {
    const conversation = await prisma.conversation.findFirst({
      where: { id, gymId },
      include: {
        student: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 200 },
      },
    });
    if (!conversation) return null;

    return {
      id: conversation.id,
      studentId: conversation.studentId,
      phone: conversation.phone,
      studentName: conversation.student?.name ?? null,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        content: message.content,
        handledByAi: message.handledByAi,
        createdAt: message.createdAt,
      })),
    };
  },

  async updateInstanceName(gymId: string, instanceName: string | null): Promise<void> {
    await prisma.gym.update({ where: { id: gymId }, data: { whatsappInstanceName: instanceName } });
  },

  async logAgentAction(entry): Promise<void> {
    try {
      await prisma.agentAction.create({
        data: {
          gymId: entry.gymId,
          action: entry.action,
          input: (entry.input ?? undefined) as Prisma.InputJsonValue | undefined,
          output: (entry.output ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[whatsapp] falha ao registrar AgentAction ${entry.action}:`, error);
    }
  },
};

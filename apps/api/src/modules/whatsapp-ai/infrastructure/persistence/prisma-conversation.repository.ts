import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  Conversation,
  ConversationDetail,
  ConversationMessage,
  ConversationRepository,
  ConversationSummary,
  GymByInstance,
  MessageDirection,
} from "../../domain/repositories/conversation.repository";

@Injectable()
export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findGymByInstanceName(instanceName: string): Promise<GymByInstance | null> {
    const gym = await this.prisma.gym.findUnique({ where: { whatsappInstanceName: instanceName } });
    if (!gym || !gym.whatsappInstanceName) return null;
    return { id: gym.id, name: gym.name, whatsappInstanceName: gym.whatsappInstanceName };
  }

  async findGymSettingsById(gymId: string): Promise<{ name: string; whatsappInstanceName: string | null } | null> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { name: true, whatsappInstanceName: true },
    });
    return gym ? { name: gym.name, whatsappInstanceName: gym.whatsappInstanceName } : null;
  }

  async setInstanceName(gymId: string, instanceName: string): Promise<void> {
    try {
      await this.prisma.gym.update({ where: { id: gymId }, data: { whatsappInstanceName: instanceName } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Esse nome de instância já está em uso por outra academia.");
      }
      throw error;
    }
  }

  async findOrCreateByPhone(gymId: string, phone: string): Promise<Conversation> {
    const existing = await this.prisma.conversation.findFirst({ where: { gymId, phone } });
    if (existing) return this.toDomain(existing);

    const created = await this.prisma.conversation.create({ data: { gymId, phone } });
    return this.toDomain(created);
  }

  async appendMessage(
    conversationId: string,
    direction: MessageDirection,
    content: string,
    handledByAi: boolean,
  ): Promise<ConversationMessage> {
    const message = await this.prisma.message.create({
      data: { conversationId, direction, content, handledByAi },
    });
    return this.toMessageDomain(message);
  }

  async getRecentMessages(conversationId: string, limit: number): Promise<ConversationMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return messages.reverse().map((message) => this.toMessageDomain(message));
  }

  async linkStudent(conversationId: string, studentId: string): Promise<void> {
    try {
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { studentId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return; // student already linked to a different conversation — not fatal
      }
      throw error;
    }
  }

  async listConversations(gymId: string): Promise<ConversationSummary[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { gymId },
      include: {
        student: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    return conversations.map((conversation) => ({
      ...this.toDomain(conversation),
      studentName: conversation.student?.name ?? null,
      lastMessage: conversation.messages[0] ? this.toMessageDomain(conversation.messages[0]) : null,
    }));
  }

  async getConversationDetail(gymId: string, id: string): Promise<ConversationDetail | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, gymId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return null;
    return {
      ...this.toDomain(conversation),
      messages: conversation.messages.map((message) => this.toMessageDomain(message)),
    };
  }

  private toDomain(conversation: { id: string; gymId: string; studentId: string | null; phone: string }): Conversation {
    return {
      id: conversation.id,
      gymId: conversation.gymId,
      studentId: conversation.studentId,
      phone: conversation.phone,
    };
  }

  private toMessageDomain(message: {
    id: string;
    direction: string;
    content: string;
    handledByAi: boolean;
    createdAt: Date;
  }): ConversationMessage {
    return {
      id: message.id,
      direction: message.direction as MessageDirection,
      content: message.content,
      handledByAi: message.handledByAi,
      createdAt: message.createdAt,
    };
  }
}

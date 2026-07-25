import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { DeliveryType, PaymentMethodType } from "@rfitness/database";
import { PRODUCT_REPOSITORY, ProductRepository } from "../../../catalog/domain/repositories/product.repository";
import { StudentsService } from "../../../students/application/services/students.service";
import { OrdersService } from "../../../orders/application/services/orders.service";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from "../../domain/repositories/conversation.repository";
import { AGENT_ACTION_REPOSITORY, AgentActionRepository } from "../../domain/repositories/agent-action.repository";
import { WHATSAPP_GATEWAY, WhatsAppGateway } from "../../domain/gateways/whatsapp.gateway";
import { ClaudeAgentService, type AgentTool } from "./claude-agent.service";

const HISTORY_LOOKBACK_MESSAGES = 10;

function buildSystemPrompt(gymName: string, studentName: string | null): string {
  return [
    `Você é o assistente virtual da academia ${gymName}, atendendo pelo WhatsApp.`,
    studentName
      ? `Você está falando com ${studentName}, aluno(a) da academia.`
      : "Você está falando com um contato que ainda não foi identificado como aluno.",
    "Responda em português do Brasil, de forma breve, cordial e direta — mensagens de WhatsApp, não e-mails.",
    "Use as ferramentas disponíveis para consultar produtos/preços/estoque e status de matrícula em vez de inventar informações.",
    "Se o cliente quiser comprar algo, confirme os itens, a forma de pagamento e se é entrega ou retirada antes de criar o pedido com a ferramenta create_order.",
    "Se não souber responder algo ou for um assunto sensível (financeiro, saúde), oriente a pessoa a falar com a recepção.",
  ].join(" ");
}

@Injectable()
export class WhatsAppAgentService {
  private readonly logger = new Logger(WhatsAppAgentService.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(AGENT_ACTION_REPOSITORY) private readonly agentActions: AgentActionRepository,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGateway,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    private readonly studentsService: StudentsService,
    private readonly ordersService: OrdersService,
    private readonly claudeAgent: ClaudeAgentService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async handleIncomingMessage(instanceName: string, phone: string, text: string): Promise<void> {
    const gym = await this.conversations.findGymByInstanceName(instanceName);
    if (!gym) {
      this.logger.warn(`Nenhuma academia encontrada para a instância WhatsApp "${instanceName}".`);
      return;
    }

    const conversation = await this.conversations.findOrCreateByPhone(gym.id, phone);
    await this.conversations.appendMessage(conversation.id, "INBOUND", text, false);

    const student = await this.studentsService.findByPhone(gym.id, phone);
    if (student && !conversation.studentId) {
      await this.conversations.linkStudent(conversation.id, student.id);
    }

    const history = await this.conversations.getRecentMessages(conversation.id, HISTORY_LOOKBACK_MESSAGES);
    const chatHistory = history
      .slice(0, -1) // the message we just appended is passed separately as userMessage
      .map((message) => ({
        role: (message.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
        content: message.content,
      }));

    const tools = this.buildTools(gym.id, student?.id ?? null, phone, student?.name ?? null);

    const reply = await this.claudeAgent.run({
      systemPrompt: buildSystemPrompt(gym.name, student?.name ?? null),
      history: chatHistory,
      userMessage: text,
      tools,
    });

    await this.conversations.appendMessage(conversation.id, "OUTBOUND", reply, true);
    await this.gateway.sendMessage(instanceName, phone, reply);
    await this.agentActions.log({ action: "whatsapp.reply", input: { phone, text }, output: { reply } });
    this.realtimeService.emitToGym(gym.id, "whatsapp.message.received", { conversationId: conversation.id });
  }

  @OnEvent("student.created")
  async handleStudentCreated(payload: { gymId: string; studentId: string }): Promise<void> {
    try {
      await this.sendWelcomeMessage(payload.gymId, payload.studentId);
    } catch (error) {
      this.logger.warn(`Falha ao enviar mensagem de boas-vindas para ${payload.studentId}: ${error}`);
    }
  }

  async sendWelcomeMessage(gymId: string, studentId: string): Promise<void> {
    const student = await this.studentsService.getStudent(gymId, studentId);
    if (!student?.whatsapp) return;

    const gymSettings = await this.conversations.findGymSettingsById(gymId);
    if (!gymSettings) return;

    const message = [
      `Olá ${student.name}!`,
      `Seja muito bem-vindo(a) à ${gymSettings.name}!`,
      "Esperamos que você alcance todos os seus objetivos.",
      "Qualquer dúvida estamos à disposição. Bom treino!",
    ].join("\n");

    await this.sendTemplateMessage(gymId, gymSettings.whatsappInstanceName, student.whatsapp, message);
  }

  async sendFollowUpMessage(gymId: string, studentName: string, phone: string): Promise<void> {
    const gymSettings = await this.conversations.findGymSettingsById(gymId);
    if (!gymSettings) return;

    const message = [
      `Olá ${studentName}!`,
      "Como está sendo seu treino? Está gostando?",
      "Tem alguma sugestão para melhorarmos? Precisando de ajuda é só responder esta mensagem.",
    ].join("\n");

    await this.sendTemplateMessage(gymId, gymSettings.whatsappInstanceName, phone, message);
  }

  private async sendTemplateMessage(
    gymId: string,
    instanceName: string | null,
    phone: string,
    message: string,
  ): Promise<void> {
    if (!instanceName) {
      this.logger.warn(`Academia ${gymId} não tem instância do WhatsApp configurada — mensagem não enviada.`);
      return;
    }

    const conversation = await this.conversations.findOrCreateByPhone(gymId, phone);
    await this.conversations.appendMessage(conversation.id, "OUTBOUND", message, false);
    await this.gateway.sendMessage(instanceName, phone, message);
  }

  private buildTools(
    gymId: string,
    studentId: string | null,
    phone: string,
    studentName: string | null,
  ): AgentTool[] {
    return [
      {
        name: "search_product",
        description:
          "Busca produtos da loja da academia (suplementos, camisetas, etc.) por nome, mostrando preço e estoque disponível de cada SKU.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nome ou parte do nome do produto buscado" },
          },
          required: ["query"],
        },
        execute: async (input) => {
          const products = await this.products.findAll(gymId, { search: String(input.query ?? "") });
          return products.slice(0, 5).flatMap((product) =>
            product.variants.map((variant) => ({
              product: product.name,
              sku: variant.sku,
              flavor: variant.flavor,
              weight: variant.weight,
              price: variant.salePrice,
              inStock: variant.currentQuantity > 0,
              quantity: variant.currentQuantity,
            })),
          );
        },
      },
      {
        name: "check_membership_status",
        description:
          "Consulta o status da matrícula/plano do aluno que está enviando a mensagem (se ele já foi identificado).",
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          if (!studentId) return { identified: false };
          const student = await this.studentsService.getStudent(gymId, studentId);
          if (!student) return { identified: false };
          const activeSubscription = student.subscriptions[0];
          return {
            identified: true,
            status: student.status,
            planName: activeSubscription?.planName ?? null,
            dueDate: activeSubscription?.dueDate ?? null,
          };
        },
      },
      {
        name: "create_order",
        description:
          "Cria um pedido de produtos da loja para retirada ou entrega, depois de confirmar com o cliente quais itens, forma de pagamento e se é entrega ou retirada. Sempre use search_product antes para confirmar que o produto existe e está em estoque.",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "Itens do pedido",
              items: {
                type: "object",
                properties: {
                  sku: { type: "string", description: "SKU exato retornado por search_product" },
                  quantity: { type: "integer", description: "Quantidade desejada" },
                },
                required: ["sku", "quantity"],
              },
            },
            deliveryType: { type: "string", enum: ["DELIVERY", "PICKUP"] },
            paymentMethod: { type: "string", enum: ["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX", "BOLETO"] },
            address: { type: "string", description: "Endereço de entrega, obrigatório se deliveryType for DELIVERY" },
          },
          required: ["items", "deliveryType", "paymentMethod"],
        },
        execute: async (input) => {
          const items = Array.isArray(input.items) ? (input.items as { sku: string; quantity: number }[]) : [];
          const resolved = await Promise.all(
            items.map(async (item) => {
              const products = await this.products.findAll(gymId, { search: item.sku });
              const variant = products.flatMap((p) => p.variants).find((v) => v.sku === item.sku);
              return variant ? { variantId: variant.id, quantity: item.quantity, sku: item.sku } : null;
            }),
          );

          const missing = resolved.filter((r) => !r).length;
          const found = resolved.filter((r): r is { variantId: string; quantity: number; sku: string } => Boolean(r));
          if (found.length === 0) {
            return { error: "Nenhum dos SKUs informados foi encontrado. Use search_product novamente." };
          }

          const order = await this.ordersService.createOrder(gymId, {
            studentId: studentId ?? undefined,
            customerName: studentName ?? "Cliente WhatsApp",
            customerPhone: phone,
            address: input.address as string | undefined,
            deliveryType: input.deliveryType as DeliveryType,
            paymentMethod: input.paymentMethod as PaymentMethodType,
            items: found.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
          });

          return {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            status: order.status,
            itemsNotFound: missing,
          };
        },
      },
    ];
  }
}

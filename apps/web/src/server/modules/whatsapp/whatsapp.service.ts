import type { DeliveryType, PaymentMethodType } from "@prisma/client";
import type { AgentTool, ClaudeAgent } from "./claude-agent";
import type {
  ConversationRepository,
  ProductMatch,
  WhatsAppGateway,
  WhatsAppSideEffects,
} from "./whatsapp.ports";

const HISTORY_LOOKBACK_MESSAGES = 10;

function buildSystemPrompt(gymName: string, studentName: string | null): string {
  return [
    `Você é o assistente virtual da academia ${gymName}, atendendo pelo WhatsApp.`,
    studentName
      ? `Você está falando com ${studentName}, aluno(a) da academia.`
      : "Você está falando com um contato que ainda não foi identificado como aluno.",
    "Responda em português do Brasil, de forma breve, cordial e direta — é WhatsApp, não e-mail.",
    "Use as ferramentas para consultar produtos, preços, estoque e status de matrícula em vez de inventar informação.",
    "Se o cliente quiser comprar, confirme os itens, a forma de pagamento e se é entrega ou retirada antes de chamar create_order.",
    "Assunto sensível (financeiro detalhado, saúde) ou algo que você não sabe: oriente a pessoa a falar com a recepção.",
  ].join(" ");
}

export function createWhatsAppService(
  repository: ConversationRepository,
  gateway: WhatsAppGateway,
  agent: ClaudeAgent,
  sideEffects: WhatsAppSideEffects,
) {
  function buildTools(
    gymId: string,
    studentId: string | null,
    studentName: string | null,
    phone: string,
  ): AgentTool[] {
    return [
      {
        name: "search_product",
        description:
          "Busca produtos da loja da academia (suplementos, bebidas, vestuário) por nome, com preço e estoque de cada SKU.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nome ou parte do nome do produto" },
          },
          required: ["query"],
        },
        execute: async (input) => {
          const matches = await sideEffects.searchProducts(gymId, String(input.query ?? ""));
          return matches.slice(0, 8).map((match) => ({
            product: match.productName,
            sku: match.sku,
            flavor: match.flavor ?? null,
            weight: match.weight ?? null,
            price: match.salePrice,
            inStock: match.quantity > 0,
            quantity: match.quantity,
          }));
        },
      },
      {
        name: "check_membership_status",
        description:
          "Consulta status da matrícula e vencimento do plano do aluno que está enviando a mensagem, se ele já foi identificado.",
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          if (!studentId) return { identified: false };
          const student = await sideEffects.getStudent(gymId, studentId);
          if (!student) return { identified: false };

          const active = student.subscriptions?.find((subscription) => !subscription.cancelledAt);
          return {
            identified: true,
            status: student.status ?? null,
            planName: active?.planName ?? null,
            dueDate: active?.dueDate ?? null,
          };
        },
      },
      {
        name: "create_order",
        description:
          "Cria um pedido para retirada ou entrega depois de confirmar itens, forma de pagamento e modalidade com o cliente. Use search_product antes para confirmar SKU e estoque.",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "Itens do pedido",
              items: {
                type: "object",
                properties: {
                  sku: { type: "string", description: "SKU exato devolvido por search_product" },
                  quantity: { type: "integer", description: "Quantidade desejada" },
                },
                required: ["sku", "quantity"],
              },
            },
            deliveryType: { type: "string", enum: ["DELIVERY", "PICKUP"] },
            paymentMethod: {
              type: "string",
              enum: ["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX", "BOLETO"],
            },
            address: {
              type: "string",
              description: "Endereço de entrega, obrigatório quando deliveryType = DELIVERY",
            },
          },
          required: ["items", "deliveryType", "paymentMethod"],
        },
        execute: async (input) => {
          const requested = Array.isArray(input.items)
            ? (input.items as { sku?: string; quantity?: number }[])
            : [];

          const resolved: { variantId: string; quantity: number }[] = [];
          const missing: string[] = [];

          for (const item of requested) {
            const sku = String(item.sku ?? "").trim();
            const quantity = Number(item.quantity ?? 0);
            if (!sku || quantity <= 0) continue;

            // eslint-disable-next-line no-await-in-loop
            const matches = await sideEffects.searchProducts(gymId, sku);
            const match = matches.find((candidate: ProductMatch) => candidate.sku === sku);
            if (match) {
              resolved.push({ variantId: match.variantId, quantity });
            } else {
              missing.push(sku);
            }
          }

          if (resolved.length === 0) {
            return {
              error:
                "Nenhum dos SKUs informados foi encontrado. Use search_product novamente para pegar o SKU exato.",
              missingSkus: missing,
            };
          }

          const order = await sideEffects.createOrder(gymId, {
            studentId,
            customerName: studentName ?? "Cliente WhatsApp",
            customerPhone: phone,
            address: (input.address as string | undefined) ?? null,
            deliveryType: input.deliveryType as DeliveryType,
            paymentMethod: input.paymentMethod as PaymentMethodType,
            items: resolved,
          });

          return {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            status: order.status,
            skusNotFound: missing,
          };
        },
      },
    ];
  }

  /**
   * Pipeline de mensagem recebida: resolve o tenant pela instância da Evolution
   * API, persiste INBOUND, identifica o aluno, roda o agente e envia a resposta.
   */
  async function handleIncomingMessage(
    instanceName: string,
    phone: string,
    text: string,
  ): Promise<void> {
    const gym = await repository.findGymByInstanceName(instanceName);
    if (!gym) {
      // eslint-disable-next-line no-console
      console.warn(`[whatsapp] nenhuma academia para a instância "${instanceName}" — mensagem ignorada.`);
      return;
    }

    const conversation = await repository.findOrCreateByPhone(gym.id, phone);
    await repository.appendMessage(conversation.id, "INBOUND", text, false);

    const student = await sideEffects.findStudentByPhone(gym.id, phone);
    if (student && !conversation.studentId) {
      await repository.linkStudent(conversation.id, student.id);
    }

    const history = await repository.getRecentMessages(conversation.id, HISTORY_LOOKBACK_MESSAGES);
    // A última entrada é a mensagem que acabamos de gravar; ela vai separada
    // como `userMessage`, então não pode aparecer duplicada no histórico.
    const chatHistory = history.slice(0, -1).map((message) => ({
      role: (message.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
      content: message.content,
    }));

    const reply = await agent.run({
      systemPrompt: buildSystemPrompt(gym.name, student?.name ?? null),
      history: chatHistory,
      userMessage: text,
      tools: buildTools(gym.id, student?.id ?? null, student?.name ?? null, phone),
    });

    await repository.appendMessage(conversation.id, "OUTBOUND", reply, true);
    if (gym.whatsappInstanceName) {
      await gateway.sendMessage(gym.whatsappInstanceName, phone, reply);
    }

    await repository.logAgentAction({
      gymId: gym.id,
      action: "whatsapp.reply",
      input: { phone, text },
      output: { reply },
    });
    await sideEffects.publish(gym.id, "whatsapp.message.received", { conversationId: conversation.id });
  }

  /** Mensagens de template: gravadas com handledByAi=false para distinguir da IA. */
  async function sendTemplateMessage(gymId: string, phone: string, message: string): Promise<void> {
    const gym = await repository.findGymById(gymId);
    if (!gym?.whatsappInstanceName) {
      // eslint-disable-next-line no-console
      console.warn(`[whatsapp] academia ${gymId} sem instância configurada — mensagem não enviada.`);
      return;
    }

    const conversation = await repository.findOrCreateByPhone(gymId, phone);
    await repository.appendMessage(conversation.id, "OUTBOUND", message, false);
    await gateway.sendMessage(gym.whatsappInstanceName, phone, message);
  }

  async function sendWelcomeMessage(gymId: string, studentId: string): Promise<void> {
    const student = await sideEffects.getStudent(gymId, studentId);
    if (!student?.whatsapp) return;

    const gym = await repository.findGymById(gymId);
    if (!gym) return;

    const message = [
      `Olá ${student.name}!`,
      `Seja muito bem-vindo(a) à ${gym.name}!`,
      "Esperamos que você alcance todos os seus objetivos.",
      "Qualquer dúvida é só responder aqui. Bom treino! 💪",
    ].join("\n");

    await sendTemplateMessage(gymId, student.whatsapp, message);
  }

  async function sendFollowUpMessage(gymId: string, studentName: string, phone: string): Promise<void> {
    const message = [
      `Olá ${studentName}!`,
      "Como está sendo seu treino? Está gostando?",
      "Tem alguma sugestão para melhorarmos? Precisando de ajuda, é só responder esta mensagem.",
    ].join("\n");

    await sendTemplateMessage(gymId, phone, message);
  }

  function listConversations(gymId: string) {
    return repository.listConversations(gymId);
  }

  function getConversation(gymId: string, id: string) {
    return repository.getConversation(gymId, id);
  }

  function updateSettings(gymId: string, instanceName: string | null) {
    return repository.updateInstanceName(gymId, instanceName);
  }

  return {
    handleIncomingMessage,
    sendWelcomeMessage,
    sendFollowUpMessage,
    listConversations,
    getConversation,
    updateSettings,
  };
}

export type WhatsAppService = ReturnType<typeof createWhatsAppService>;

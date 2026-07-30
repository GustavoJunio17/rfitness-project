import { describe, expect, it, vi } from "vitest";
import { createWhatsAppService } from "./whatsapp.service";
import type { ConversationRepository, WhatsAppGateway, WhatsAppSideEffects } from "./whatsapp.ports";

const gym = { id: "gym-1", name: "RFitness Demo", whatsappInstanceName: "rfitness-demo" };

function makeRepo(overrides: Partial<ConversationRepository> = {}): ConversationRepository {
  return {
    findGymByInstanceName: vi.fn().mockResolvedValue(gym),
    findGymById: vi.fn().mockResolvedValue(gym),
    findOrCreateByPhone: vi
      .fn()
      .mockResolvedValue({ id: "conv-1", studentId: null, phone: "5531999990000" }),
    appendMessage: vi.fn().mockResolvedValue(undefined),
    linkStudent: vi.fn().mockResolvedValue(undefined),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    listConversations: vi.fn().mockResolvedValue([]),
    getConversation: vi.fn().mockResolvedValue(null),
    updateInstanceName: vi.fn().mockResolvedValue(undefined),
    logAgentAction: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeGateway(): WhatsAppGateway {
  return { sendMessage: vi.fn().mockResolvedValue(undefined) };
}

function makeSideEffects(overrides: Partial<WhatsAppSideEffects> = {}): WhatsAppSideEffects {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    findStudentByPhone: vi.fn().mockResolvedValue(null),
    getStudent: vi.fn().mockResolvedValue(null),
    searchProducts: vi.fn().mockResolvedValue([]),
    createOrder: vi.fn(),
    ...overrides,
  };
}

const agent = (reply = "Bom treino!") => ({ run: vi.fn().mockResolvedValue(reply) });

describe("handleIncomingMessage", () => {
  it("grava a mensagem recebida, responde e envia pelo gateway", async () => {
    const repo = makeRepo();
    const gateway = makeGateway();
    const claude = agent("Temos whey sim!");
    const service = createWhatsAppService(repo, gateway, claude, makeSideEffects());

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "tem whey?");

    expect(repo.appendMessage).toHaveBeenCalledWith("conv-1", "INBOUND", "tem whey?", false);
    expect(repo.appendMessage).toHaveBeenCalledWith("conv-1", "OUTBOUND", "Temos whey sim!", true);
    expect(gateway.sendMessage).toHaveBeenCalledWith("rfitness-demo", "5531999990000", "Temos whey sim!");
  });

  it("ignora instância que não pertence a nenhuma academia", async () => {
    const repo = makeRepo({ findGymByInstanceName: vi.fn().mockResolvedValue(null) });
    const gateway = makeGateway();
    const service = createWhatsAppService(repo, gateway, agent(), makeSideEffects());

    await service.handleIncomingMessage("instancia-desconhecida", "5531999990000", "oi");

    expect(repo.appendMessage).not.toHaveBeenCalled();
    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("vincula o aluno à conversa quando o telefone é reconhecido", async () => {
    const repo = makeRepo();
    const sideEffects = makeSideEffects({
      findStudentByPhone: vi.fn().mockResolvedValue({ id: "student-1", name: "Ana" }),
    });
    const service = createWhatsAppService(repo, makeGateway(), agent(), sideEffects);

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "oi");

    expect(repo.linkStudent).toHaveBeenCalledWith("conv-1", "student-1");
  });

  it("não revincula aluno já ligado à conversa", async () => {
    const repo = makeRepo({
      findOrCreateByPhone: vi
        .fn()
        .mockResolvedValue({ id: "conv-1", studentId: "student-1", phone: "5531999990000" }),
    });
    const sideEffects = makeSideEffects({
      findStudentByPhone: vi.fn().mockResolvedValue({ id: "student-1", name: "Ana" }),
    });
    const service = createWhatsAppService(repo, makeGateway(), agent(), sideEffects);

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "oi");

    expect(repo.linkStudent).not.toHaveBeenCalled();
  });

  it("passa o histórico sem repetir a mensagem atual", async () => {
    const repo = makeRepo({
      getRecentMessages: vi.fn().mockResolvedValue([
        { direction: "INBOUND", content: "oi" },
        { direction: "OUTBOUND", content: "olá!" },
        { direction: "INBOUND", content: "tem whey?" },
      ]),
    });
    const claude = agent();
    const service = createWhatsAppService(repo, makeGateway(), claude, makeSideEffects());

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "tem whey?");

    const params = claude.run.mock.calls[0]![0];
    expect(params.history).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá!" },
    ]);
    expect(params.userMessage).toBe("tem whey?");
  });

  it("identifica o aluno no system prompt quando há vínculo", async () => {
    const sideEffects = makeSideEffects({
      findStudentByPhone: vi.fn().mockResolvedValue({ id: "student-1", name: "Ana Souza" }),
    });
    const claude = agent();
    const service = createWhatsAppService(makeRepo(), makeGateway(), claude, sideEffects);

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "oi");

    expect(claude.run.mock.calls[0]![0].systemPrompt).toContain("Ana Souza");
    expect(claude.run.mock.calls[0]![0].systemPrompt).toContain("RFitness Demo");
  });

  it("registra AgentAction e publica sinal de mensagem recebida", async () => {
    const repo = makeRepo();
    const sideEffects = makeSideEffects();
    const service = createWhatsAppService(repo, makeGateway(), agent(), sideEffects);

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "oi");

    expect(repo.logAgentAction).toHaveBeenCalledWith(
      expect.objectContaining({ gymId: "gym-1", action: "whatsapp.reply" }),
    );
    expect(sideEffects.publish).toHaveBeenCalledWith("gym-1", "whatsapp.message.received", {
      conversationId: "conv-1",
    });
  });

  it("expõe exatamente as três ferramentas do agente", async () => {
    const claude = agent();
    const service = createWhatsAppService(makeRepo(), makeGateway(), claude, makeSideEffects());

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "oi");

    expect(claude.run.mock.calls[0]![0].tools.map((tool: { name: string }) => tool.name)).toEqual([
      "search_product",
      "check_membership_status",
      "create_order",
    ]);
  });
});

describe("ferramenta create_order", () => {
  async function runToolWith(sideEffects: WhatsAppSideEffects, studentName: string | null = null) {
    const claude = agent();
    const service = createWhatsAppService(
      makeRepo(),
      makeGateway(),
      claude,
      studentName
        ? {
            ...sideEffects,
            findStudentByPhone: vi.fn().mockResolvedValue({ id: "student-1", name: studentName }),
          }
        : sideEffects,
    );

    await service.handleIncomingMessage("rfitness-demo", "5531999990000", "quero comprar");
    const tools = claude.run.mock.calls[0]![0].tools as {
      name: string;
      execute: (input: Record<string, unknown>) => Promise<unknown>;
    }[];
    return tools.find((tool) => tool.name === "create_order")!;
  }

  it("resolve o SKU e cria o pedido", async () => {
    const createOrder = vi.fn().mockResolvedValue({ orderNumber: 12, totalAmount: 139.9, status: "PENDING" });
    const sideEffects = makeSideEffects({
      searchProducts: vi.fn().mockResolvedValue([
        { productName: "Whey", sku: "WHE-GRO-BAU-900G", variantId: "var-1", salePrice: 139.9, quantity: 5 },
      ]),
      createOrder,
    });

    const tool = await runToolWith(sideEffects, "Ana Souza");
    const result = await tool.execute({
      items: [{ sku: "WHE-GRO-BAU-900G", quantity: 1 }],
      deliveryType: "PICKUP",
      paymentMethod: "PIX",
    });

    expect(createOrder).toHaveBeenCalledWith(
      "gym-1",
      expect.objectContaining({
        customerName: "Ana Souza",
        customerPhone: "5531999990000",
        studentId: "student-1",
        deliveryType: "PICKUP",
        paymentMethod: "PIX",
        items: [{ variantId: "var-1", quantity: 1 }],
      }),
    );
    expect(result).toMatchObject({ orderNumber: 12, status: "PENDING" });
  });

  it("devolve erro instrutivo quando nenhum SKU é encontrado", async () => {
    const sideEffects = makeSideEffects({ searchProducts: vi.fn().mockResolvedValue([]) });
    const tool = await runToolWith(sideEffects);

    const result = (await tool.execute({
      items: [{ sku: "NAO-EXISTE", quantity: 1 }],
      deliveryType: "PICKUP",
      paymentMethod: "PIX",
    })) as { error?: string };

    expect(result.error).toMatch(/search_product/);
  });

  it("usa nome genérico quando o contato não é aluno", async () => {
    const createOrder = vi.fn().mockResolvedValue({ orderNumber: 1, totalAmount: 10, status: "PENDING" });
    const sideEffects = makeSideEffects({
      searchProducts: vi
        .fn()
        .mockResolvedValue([
          { productName: "Água", sku: "AGU-RFI-1L", variantId: "var-9", salePrice: 9, quantity: 10 },
        ]),
      createOrder,
    });

    const tool = await runToolWith(sideEffects);
    await tool.execute({
      items: [{ sku: "AGU-RFI-1L", quantity: 2 }],
      deliveryType: "DELIVERY",
      address: "Rua A, 100",
      paymentMethod: "CASH",
    });

    expect(createOrder).toHaveBeenCalledWith(
      "gym-1",
      expect.objectContaining({ customerName: "Cliente WhatsApp", studentId: null, address: "Rua A, 100" }),
    );
  });
});

describe("mensagens proativas", () => {
  it("boas-vindas só sai quando o aluno tem WhatsApp", async () => {
    const gateway = makeGateway();
    const sideEffects = makeSideEffects({
      getStudent: vi.fn().mockResolvedValue({ id: "student-1", name: "Ana", whatsapp: null }),
    });
    const service = createWhatsAppService(makeRepo(), gateway, agent(), sideEffects);

    await service.sendWelcomeMessage("gym-1", "student-1");

    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("boas-vindas grava mensagem como template (handledByAi=false)", async () => {
    const repo = makeRepo();
    const gateway = makeGateway();
    const sideEffects = makeSideEffects({
      getStudent: vi.fn().mockResolvedValue({ id: "student-1", name: "Ana", whatsapp: "5531999991111" }),
    });
    const service = createWhatsAppService(repo, gateway, agent(), sideEffects);

    await service.sendWelcomeMessage("gym-1", "student-1");

    expect(repo.appendMessage).toHaveBeenCalledWith("conv-1", "OUTBOUND", expect.any(String), false);
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      "rfitness-demo",
      "5531999991111",
      expect.stringContaining("Ana"),
    );
  });

  it("não envia nada quando a academia não tem instância configurada", async () => {
    const repo = makeRepo({
      findGymById: vi.fn().mockResolvedValue({ ...gym, whatsappInstanceName: null }),
    });
    const gateway = makeGateway();
    const sideEffects = makeSideEffects({
      getStudent: vi.fn().mockResolvedValue({ id: "student-1", name: "Ana", whatsapp: "5531999991111" }),
    });
    const service = createWhatsAppService(repo, gateway, agent(), sideEffects);

    await service.sendWelcomeMessage("gym-1", "student-1");

    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("follow-up envia texto de acompanhamento", async () => {
    const gateway = makeGateway();
    const service = createWhatsAppService(makeRepo(), gateway, agent(), makeSideEffects());

    await service.sendFollowUpMessage("gym-1", "Ana", "5531999991111");

    expect(gateway.sendMessage).toHaveBeenCalledWith(
      "rfitness-demo",
      "5531999991111",
      expect.stringMatching(/treino/i),
    );
  });
});

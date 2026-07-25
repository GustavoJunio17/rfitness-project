import { WhatsAppAgentService } from "./whatsapp-agent.service";
import type { ConversationRepository, Conversation } from "../../domain/repositories/conversation.repository";
import type { AgentActionRepository } from "../../domain/repositories/agent-action.repository";
import type { WhatsAppGateway } from "../../domain/gateways/whatsapp.gateway";
import type { ProductRepository } from "../../../catalog/domain/repositories/product.repository";
import type { StudentsService } from "../../../students/application/services/students.service";
import type { OrdersService } from "../../../orders/application/services/orders.service";
import type { RealtimeService } from "../../../../shared/realtime/realtime.service";
import type { ClaudeAgentService } from "./claude-agent.service";

function buildConversation(overrides: Partial<Conversation> = {}): Conversation {
  return { id: "conv-1", gymId: "gym-1", studentId: null, phone: "5511999990000", ...overrides };
}

describe("WhatsAppAgentService", () => {
  let conversations: jest.Mocked<ConversationRepository>;
  let agentActions: jest.Mocked<AgentActionRepository>;
  let gateway: jest.Mocked<WhatsAppGateway>;
  let products: jest.Mocked<ProductRepository>;
  let studentsService: jest.Mocked<StudentsService>;
  let ordersService: jest.Mocked<OrdersService>;
  let claudeAgent: jest.Mocked<ClaudeAgentService>;
  let realtimeService: jest.Mocked<RealtimeService>;
  let service: WhatsAppAgentService;

  beforeEach(() => {
    conversations = {
      findGymByInstanceName: jest.fn(),
      findGymSettingsById: jest.fn(),
      setInstanceName: jest.fn(),
      findOrCreateByPhone: jest.fn(),
      appendMessage: jest.fn(),
      getRecentMessages: jest.fn(),
      linkStudent: jest.fn(),
      listConversations: jest.fn(),
      getConversationDetail: jest.fn(),
    };
    agentActions = { log: jest.fn() };
    gateway = { sendMessage: jest.fn() };
    products = { findAll: jest.fn() } as unknown as jest.Mocked<ProductRepository>;
    studentsService = {
      findByPhone: jest.fn(),
      getStudent: jest.fn(),
    } as unknown as jest.Mocked<StudentsService>;
    ordersService = { createOrder: jest.fn() } as unknown as jest.Mocked<OrdersService>;
    claudeAgent = { run: jest.fn() } as unknown as jest.Mocked<ClaudeAgentService>;
    realtimeService = { emitToGym: jest.fn() } as unknown as jest.Mocked<RealtimeService>;

    service = new WhatsAppAgentService(
      conversations,
      agentActions,
      gateway,
      products,
      studentsService,
      ordersService,
      claudeAgent,
      realtimeService,
    );
  });

  describe("handleIncomingMessage", () => {
    it("does nothing when the instance does not map to a gym", async () => {
      conversations.findGymByInstanceName.mockResolvedValue(null);

      await service.handleIncomingMessage("unknown-instance", "5511999990000", "oi");

      expect(conversations.findOrCreateByPhone).not.toHaveBeenCalled();
      expect(gateway.sendMessage).not.toHaveBeenCalled();
    });

    it("processes an inbound message end to end for an unidentified contact", async () => {
      conversations.findGymByInstanceName.mockResolvedValue({
        id: "gym-1",
        name: "RFitness",
        whatsappInstanceName: "rfitness-demo",
      });
      conversations.findOrCreateByPhone.mockResolvedValue(buildConversation());
      studentsService.findByPhone.mockResolvedValue(null);
      conversations.getRecentMessages.mockResolvedValue([
        { id: "m1", direction: "INBOUND", content: "oi", handledByAi: false, createdAt: new Date() },
      ]);
      claudeAgent.run.mockResolvedValue("Olá! Como posso ajudar?");

      await service.handleIncomingMessage("rfitness-demo", "5511999990000", "oi");

      expect(conversations.appendMessage).toHaveBeenCalledWith("conv-1", "INBOUND", "oi", false);
      expect(conversations.linkStudent).not.toHaveBeenCalled();
      expect(claudeAgent.run).toHaveBeenCalledWith(
        expect.objectContaining({ userMessage: "oi", tools: expect.any(Array) }),
      );
      expect(conversations.appendMessage).toHaveBeenCalledWith("conv-1", "OUTBOUND", "Olá! Como posso ajudar?", true);
      expect(gateway.sendMessage).toHaveBeenCalledWith("rfitness-demo", "5511999990000", "Olá! Como posso ajudar?");
      expect(agentActions.log).toHaveBeenCalled();
      expect(realtimeService.emitToGym).toHaveBeenCalledWith("gym-1", "whatsapp.message.received", {
        conversationId: "conv-1",
      });
    });

    it("links the conversation to a matching student when one is found", async () => {
      conversations.findGymByInstanceName.mockResolvedValue({
        id: "gym-1",
        name: "RFitness",
        whatsappInstanceName: "rfitness-demo",
      });
      conversations.findOrCreateByPhone.mockResolvedValue(buildConversation({ studentId: null }));
      studentsService.findByPhone.mockResolvedValue({
        id: "student-1",
        gymId: "gym-1",
        name: "Maria",
        cpf: null,
        phone: null,
        whatsapp: "5511999990000",
        email: null,
        address: null,
        trainerName: null,
        status: "ACTIVE",
        enrollmentDate: new Date(),
        notes: null,
      });
      conversations.getRecentMessages.mockResolvedValue([]);
      claudeAgent.run.mockResolvedValue("Oi Maria!");

      await service.handleIncomingMessage("rfitness-demo", "5511999990000", "oi");

      expect(conversations.linkStudent).toHaveBeenCalledWith("conv-1", "student-1");
    });
  });

  describe("sendWelcomeMessage", () => {
    it("does nothing when the student has no WhatsApp number", async () => {
      studentsService.getStudent.mockResolvedValue({
        id: "student-1",
        gymId: "gym-1",
        name: "João",
        cpf: null,
        phone: null,
        whatsapp: null,
        email: null,
        address: null,
        trainerName: null,
        status: "ACTIVE",
        enrollmentDate: new Date(),
        notes: null,
        subscriptions: [],
        goals: [],
        studentNotes: [],
      });

      await service.sendWelcomeMessage("gym-1", "student-1");

      expect(gateway.sendMessage).not.toHaveBeenCalled();
    });

    it("sends a templated welcome message when the gym has an instance configured", async () => {
      studentsService.getStudent.mockResolvedValue({
        id: "student-1",
        gymId: "gym-1",
        name: "João",
        cpf: null,
        phone: null,
        whatsapp: "5511999990000",
        email: null,
        address: null,
        trainerName: null,
        status: "ACTIVE",
        enrollmentDate: new Date(),
        notes: null,
        subscriptions: [],
        goals: [],
        studentNotes: [],
      });
      conversations.findGymSettingsById.mockResolvedValue({ name: "RFitness", whatsappInstanceName: "rfitness-demo" });
      conversations.findOrCreateByPhone.mockResolvedValue(buildConversation({ phone: "5511999990000" }));

      await service.sendWelcomeMessage("gym-1", "student-1");

      expect(gateway.sendMessage).toHaveBeenCalledWith(
        "rfitness-demo",
        "5511999990000",
        expect.stringContaining("bem-vindo"),
      );
      expect(conversations.appendMessage).toHaveBeenCalledWith(
        "conv-1",
        "OUTBOUND",
        expect.stringContaining("João"),
        false,
      );
    });

    it("does not send when the gym has no WhatsApp instance configured", async () => {
      studentsService.getStudent.mockResolvedValue({
        id: "student-1",
        gymId: "gym-1",
        name: "João",
        cpf: null,
        phone: null,
        whatsapp: "5511999990000",
        email: null,
        address: null,
        trainerName: null,
        status: "ACTIVE",
        enrollmentDate: new Date(),
        notes: null,
        subscriptions: [],
        goals: [],
        studentNotes: [],
      });
      conversations.findGymSettingsById.mockResolvedValue({ name: "RFitness", whatsappInstanceName: null });

      await service.sendWelcomeMessage("gym-1", "student-1");

      expect(gateway.sendMessage).not.toHaveBeenCalled();
    });
  });
});

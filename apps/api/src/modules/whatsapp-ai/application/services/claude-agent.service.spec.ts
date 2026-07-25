import { ConfigService } from "@nestjs/config";
import { ClaudeAgentService } from "./claude-agent.service";

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

describe("ClaudeAgentService", () => {
  let configService: jest.Mocked<ConfigService>;
  let service: ClaudeAgentService;

  beforeEach(() => {
    mockCreate.mockReset();
    configService = {
      get: jest.fn((key: string) => {
        if (key === "anthropic.apiKey") return "test-key";
        if (key === "anthropic.model") return "claude-opus-4-8";
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;
    service = new ClaudeAgentService(configService);
  });

  it("returns the final text when the model answers without calling a tool", async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Olá! Como posso ajudar?" }],
    });

    const reply = await service.run({
      systemPrompt: "system",
      history: [],
      userMessage: "oi",
      tools: [],
    });

    expect(reply).toBe("Olá! Como posso ajudar?");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("executes a requested tool and feeds the result back before returning the final answer", async () => {
    const execute = jest.fn().mockResolvedValue({ price: 89.9 });

    mockCreate
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "tool-1", name: "search_product", input: { query: "whey" } }],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "O whey custa R$ 89,90." }],
      });

    const reply = await service.run({
      systemPrompt: "system",
      history: [],
      userMessage: "quanto custa o whey?",
      tools: [
        {
          name: "search_product",
          description: "busca produto",
          inputSchema: { type: "object", properties: {} },
          execute,
        },
      ],
    });

    expect(execute).toHaveBeenCalledWith({ query: "whey" });
    expect(reply).toBe("O whey custa R$ 89,90.");
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(toolResultMessage.role).toBe("user");
    expect(toolResultMessage.content[0].type).toBe("tool_result");
    expect(toolResultMessage.content[0].tool_use_id).toBe("tool-1");
  });

  it("returns a fallback message if the model keeps requesting tools past the turn limit", async () => {
    mockCreate.mockResolvedValue({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "tool-x", name: "loop", input: {} }],
    });

    const reply = await service.run({
      systemPrompt: "system",
      history: [],
      userMessage: "oi",
      tools: [{ name: "loop", description: "", inputSchema: {}, execute: async () => ({}) }],
    });

    expect(reply).toContain("Desculpe");
  });

  it("reports a tool execution error back to the model instead of throwing", async () => {
    const execute = jest.fn().mockRejectedValue(new Error("boom"));

    mockCreate
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "tool-1", name: "failing_tool", input: {} }],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Tive um problema, tente novamente." }],
      });

    const reply = await service.run({
      systemPrompt: "system",
      history: [],
      userMessage: "oi",
      tools: [{ name: "failing_tool", description: "", inputSchema: {}, execute }],
    });

    expect(reply).toBe("Tive um problema, tente novamente.");
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(JSON.parse(toolResultMessage.content[0].content)).toEqual({ error: "boom" });
  });

  it("returns a simulated reply and never calls the Anthropic SDK when ANTHROPIC_MOCK_MODE is on", async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === "anthropic.mockMode") return true;
      return undefined;
    });

    const reply = await service.run({
      systemPrompt: "system",
      history: [],
      userMessage: "quanto custa o whey?",
      tools: [],
    });

    expect(reply).toContain("quanto custa o whey?");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

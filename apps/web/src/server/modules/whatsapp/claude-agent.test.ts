import { describe, expect, it, vi } from "vitest";
import { createClaudeAgent, type AgentTool, type MessageCreate } from "./claude-agent";

const textResponse = (text: string) => ({
  stop_reason: "end_turn" as const,
  content: [{ type: "text" as const, text }],
});

const toolUseResponse = (id: string, name: string, input: Record<string, unknown>) => ({
  stop_reason: "tool_use" as const,
  content: [{ type: "tool_use" as const, id, name, input }],
});

const tool = (name: string, execute: AgentTool["execute"]): AgentTool => ({
  name,
  description: `ferramenta ${name}`,
  inputSchema: { type: "object", properties: {} },
  execute,
});

function makeAgent(responses: unknown[], overrides: Partial<Parameters<typeof createClaudeAgent>[0]> = {}) {
  const createMessage = vi.fn() as unknown as MessageCreate & { mock: { calls: unknown[][] } };
  let call = 0;
  (createMessage as unknown as { mockImplementation: (fn: () => unknown) => void }).mockImplementation(
    () => Promise.resolve(responses[Math.min(call++, responses.length - 1)]),
  );

  const agent = createClaudeAgent({
    createMessage: createMessage as unknown as MessageCreate,
    model: "claude-opus-5",
    mockMode: false,
    ...overrides,
  });

  return { agent, createMessage };
}

describe("createClaudeAgent — resposta direta", () => {
  it("devolve o texto final do modelo", async () => {
    const { agent } = makeAgent([textResponse("Bom treino!")]);

    const reply = await agent.run({
      systemPrompt: "assistente",
      history: [],
      userMessage: "oi",
      tools: [],
    });

    expect(reply).toBe("Bom treino!");
  });

  it("envia modelo, system prompt, histórico e mensagem atual", async () => {
    const { agent, createMessage } = makeAgent([textResponse("ok")]);

    await agent.run({
      systemPrompt: "você é o assistente da academia",
      history: [
        { role: "user", content: "quanto custa o whey?" },
        { role: "assistant", content: "R$ 139,90" },
      ],
      userMessage: "e a creatina?",
      tools: [],
    });

    const params = (createMessage as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock
      .calls[0]![0];

    expect(params.model).toBe("claude-opus-5");
    expect(params.system).toBe("você é o assistente da academia");
    expect(params.messages).toEqual([
      { role: "user", content: "quanto custa o whey?" },
      { role: "assistant", content: "R$ 139,90" },
      { role: "user", content: "e a creatina?" },
    ]);
  });

  it("não envia budget_tokens nem parâmetros de sampling (removidos nos modelos atuais)", async () => {
    const { agent, createMessage } = makeAgent([textResponse("ok")]);

    await agent.run({ systemPrompt: "s", history: [], userMessage: "oi", tools: [] });

    const params = (createMessage as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock
      .calls[0]![0];

    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
    expect(JSON.stringify(params.thinking ?? {})).not.toContain("budget_tokens");
  });
});

describe("createClaudeAgent — loop de ferramentas", () => {
  it("executa a ferramenta e devolve a resposta do turno seguinte", async () => {
    const execute = vi.fn().mockResolvedValue([{ sku: "WHE-GRO", price: 139.9 }]);
    const { agent, createMessage } = makeAgent([
      toolUseResponse("toolu_1", "search_product", { query: "whey" }),
      textResponse("Temos Whey Growth a R$ 139,90."),
    ]);

    const reply = await agent.run({
      systemPrompt: "s",
      history: [],
      userMessage: "tem whey?",
      tools: [tool("search_product", execute)],
    });

    expect(execute).toHaveBeenCalledWith({ query: "whey" });
    expect(reply).toBe("Temos Whey Growth a R$ 139,90.");

    // Segunda chamada precisa carregar o turno do assistente + o tool_result.
    const second = (createMessage as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock
      .calls[1]![0];
    const messages = second.messages as { role: string; content: unknown }[];
    expect(messages[messages.length - 2]!.role).toBe("assistant");
    expect(JSON.stringify(messages[messages.length - 1]!.content)).toContain("tool_result");
  });

  it("executa ferramentas paralelas do mesmo turno e devolve todos os resultados juntos", async () => {
    const first = vi.fn().mockResolvedValue({ ok: 1 });
    const second = vi.fn().mockResolvedValue({ ok: 2 });

    const { agent, createMessage } = makeAgent([
      {
        stop_reason: "tool_use" as const,
        content: [
          { type: "tool_use" as const, id: "t1", name: "a", input: {} },
          { type: "tool_use" as const, id: "t2", name: "b", input: {} },
        ],
      },
      textResponse("pronto"),
    ]);

    await agent.run({
      systemPrompt: "s",
      history: [],
      userMessage: "faz as duas coisas",
      tools: [tool("a", first), tool("b", second)],
    });

    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();

    const call = (createMessage as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock
      .calls[1]![0];
    const messages = call.messages as { role: string; content: { tool_use_id?: string }[] }[];
    const results = messages[messages.length - 1]!.content;
    expect(results).toHaveLength(2);
    expect(results.map((block) => block.tool_use_id)).toEqual(["t1", "t2"]);
  });

  it("erro na ferramenta volta como tool_result de erro em vez de derrubar a conversa", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("banco fora do ar"));
    const { agent, createMessage } = makeAgent([
      toolUseResponse("toolu_1", "search_product", { query: "x" }),
      textResponse("Não consegui consultar agora."),
    ]);

    const reply = await agent.run({
      systemPrompt: "s",
      history: [],
      userMessage: "tem whey?",
      tools: [tool("search_product", failing)],
    });

    expect(reply).toBe("Não consegui consultar agora.");
    const second = (createMessage as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock
      .calls[1]![0];
    expect(JSON.stringify(second.messages)).toContain("is_error");
  });

  it("ferramenta desconhecida devolve erro para o modelo", async () => {
    const { agent, createMessage } = makeAgent([
      toolUseResponse("toolu_1", "ferramenta_fantasma", {}),
      textResponse("ok"),
    ]);

    await agent.run({ systemPrompt: "s", history: [], userMessage: "oi", tools: [] });

    const second = (createMessage as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock
      .calls[1]![0];
    expect(JSON.stringify(second.messages)).toContain("Ferramenta desconhecida");
  });

  it("respeita o limite de turnos e devolve mensagem de fallback", async () => {
    const execute = vi.fn().mockResolvedValue({});
    const { agent, createMessage } = makeAgent([toolUseResponse("toolu_1", "loop", {})]);

    const reply = await agent.run({
      systemPrompt: "s",
      history: [],
      userMessage: "entra em loop",
      tools: [tool("loop", execute)],
    });

    expect(reply).toMatch(/recepção/i);
    expect(
      (createMessage as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
    ).toBeLessThanOrEqual(6);
  });
});

describe("createClaudeAgent — recusa e modo mock", () => {
  it("trata stop_reason refusal sem ler content", async () => {
    const { agent } = makeAgent([{ stop_reason: "refusal" as const, content: [] }]);

    const reply = await agent.run({ systemPrompt: "s", history: [], userMessage: "...", tools: [] });

    expect(reply).toMatch(/recepção/i);
  });

  it("modo mock responde sem chamar a Anthropic", async () => {
    const { agent, createMessage } = makeAgent([textResponse("nunca chamado")], { mockMode: true });

    const reply = await agent.run({
      systemPrompt: "s",
      history: [],
      userMessage: "tem whey?",
      tools: [],
    });

    expect(reply).toContain("modo mock");
    expect(reply).toContain("tem whey?");
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("resposta sem bloco de texto não devolve string vazia silenciosa", async () => {
    const { agent } = makeAgent([{ stop_reason: "end_turn" as const, content: [] }]);

    const reply = await agent.run({ systemPrompt: "s", history: [], userMessage: "oi", tools: [] });

    expect(reply.length).toBeGreaterThan(0);
  });
});

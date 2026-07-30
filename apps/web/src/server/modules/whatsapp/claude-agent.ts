import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "../../env";

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentRunParams {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  tools: AgentTool[];
}

/** Assinatura mínima usada do SDK — injetável para testar o loop sem rede. */
export type MessageCreate = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<{
  stop_reason: string | null;
  content: unknown[];
}>;

export interface ClaudeAgentDeps {
  createMessage: MessageCreate;
  model: string;
  mockMode: boolean;
}

const MAX_TOOL_TURNS = 5;
const MAX_TOKENS = 2048;
const HANDOFF_REPLY =
  "Desculpe, não consegui responder isso agora. Fale com a recepção da academia que a equipe te ajuda. 💪";

/**
 * Agente conversacional do WhatsApp: loop manual de tool use sobre o SDK da
 * Anthropic.
 *
 * Loop manual (e não o Tool Runner beta) porque o conjunto é pequeno (3
 * ferramentas), a resposta precisa ser uma string única para enviar no WhatsApp
 * e assim não trazemos dependência beta para o caminho de produção.
 *
 * Sobre os parâmetros:
 * - `thinking` fica no default do modelo (adaptativo no Claude Opus 5). Desligar
 *   pensamento neste modelo tem dois modos de falha conhecidos — chamada de
 *   ferramenta escrita como texto (o pedido nunca é criado, sem erro) e vazamento
 *   de tags internas na resposta —, então controlamos custo por `effort: "low"`,
 *   que é o recomendado para resposta curta de chat.
 * - `max_tokens` limita pensamento + texto juntos, daí a folga (2048) para uma
 *   resposta de WhatsApp que caberia em bem menos.
 * - Nada de `temperature`/`top_p`/`top_k`/`budget_tokens`: removidos nos modelos
 *   atuais e rejeitados com 400.
 */
export function createClaudeAgent(deps: ClaudeAgentDeps) {
  function buildMockReply(userMessage: string): string {
    return `[resposta simulada — modo mock ativo] Recebi sua mensagem: "${userMessage}". Desative ANTHROPIC_MOCK_MODE para a IA responder de verdade.`;
  }

  async function run(params: AgentRunParams): Promise<string> {
    if (deps.mockMode) {
      return buildMockReply(params.userMessage);
    }

    const messages: Anthropic.MessageParam[] = [
      ...params.history.map((entry) => ({ role: entry.role, content: entry.content })),
      { role: "user" as const, content: params.userMessage },
    ];

    const toolDefinitions: Anthropic.ToolUnion[] = params.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }));

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await deps.createMessage({
        model: deps.model,
        max_tokens: MAX_TOKENS,
        output_config: { effort: "low" },
        system: params.systemPrompt,
        messages,
        ...(toolDefinitions.length > 0 ? { tools: toolDefinitions } : {}),
      } as Anthropic.MessageCreateParamsNonStreaming);

      // Classificadores de segurança podem recusar: `content` vem vazio ou
      // parcial, então checamos stop_reason antes de ler qualquer bloco.
      if (response.stop_reason === "refusal") {
        return HANDOFF_REPLY;
      }

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock =>
            typeof block === "object" && block !== null && (block as { type?: string }).type === "text",
        );
        const text = textBlock?.text?.trim();
        return text && text.length > 0 ? text : HANDOFF_REPLY;
      }

      messages.push({ role: "assistant", content: response.content as Anthropic.ContentBlockParam[] });

      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock =>
          typeof block === "object" && block !== null && (block as { type?: string }).type === "tool_use",
      );

      // Ferramentas do mesmo turno rodam em paralelo e voltam num único turno de
      // usuário — dividir em mensagens separadas ensina o modelo a parar de
      // paralelizar.
      // eslint-disable-next-line no-await-in-loop
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (block) => {
          const tool = params.tools.find((candidate) => candidate.name === block.name);
          if (!tool) {
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: `Ferramenta desconhecida: ${block.name}`,
              is_error: true,
            };
          }

          try {
            const output = await tool.execute((block.input ?? {}) as Record<string, unknown>);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(output ?? null),
            };
          } catch (error) {
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: error instanceof Error ? error.message : String(error),
              is_error: true,
            };
          }
        }),
      );

      messages.push({ role: "user", content: toolResults });
    }

    // eslint-disable-next-line no-console
    console.warn("[whatsapp-agent] limite de turnos de ferramenta atingido sem resposta final.");
    return HANDOFF_REPLY;
  }

  return { run };
}

export type ClaudeAgent = ReturnType<typeof createClaudeAgent>;

let cachedClient: Anthropic | null = null;

/** Instância real, ligada ao SDK e ao env. */
export function getClaudeAgent(): ClaudeAgent {
  const env = getEnv();

  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  const client = cachedClient;

  return createClaudeAgent({
    createMessage: (params) =>
      client.messages.create(params) as unknown as ReturnType<MessageCreate>,
    model: env.ANTHROPIC_MODEL,
    mockMode: env.ANTHROPIC_MOCK_MODE,
  });
}

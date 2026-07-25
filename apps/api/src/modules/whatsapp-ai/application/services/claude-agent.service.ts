import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface ClaudeAgentRunParams {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  tools: AgentTool[];
}

const MAX_TOOL_TURNS = 5;
const MAX_TOKENS = 1024;

/**
 * Thin wrapper around the Anthropic SDK running a manual tool-use loop (not the
 * beta Tool Runner) — the tool set here is small (2-4 tools) and this avoids an
 * extra beta dependency for a straightforward WhatsApp reply generator. No
 * `thinking` param is passed: this is a short conversational reply, not a
 * reasoning-heavy task, so the model runs without thinking (the Opus 4.8 default
 * when the field is omitted).
 */
@Injectable()
export class ClaudeAgentService {
  private readonly logger = new Logger(ClaudeAgentService.name);
  private client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.configService.get<string>("anthropic.apiKey") });
    }
    return this.client;
  }

  async run(params: ClaudeAgentRunParams): Promise<string> {
    if (this.configService.get<boolean>("anthropic.mockMode")) {
      return this.buildMockReply(params.userMessage);
    }

    const client = this.getClient();
    const model = this.configService.get<string>("anthropic.model") ?? "claude-opus-4-8";

    const messages: Anthropic.MessageParam[] = [
      ...params.history.map((entry) => ({ role: entry.role, content: entry.content })),
      { role: "user" as const, content: params.userMessage },
    ];

    const toolDefinitions: Anthropic.Tool[] = params.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }));

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: params.systemPrompt,
        messages,
        tools: toolDefinitions,
      });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((block) => block.type === "text");
        return textBlock && textBlock.type === "text" ? textBlock.text : "";
      }

      messages.push({ role: "assistant", content: response.content });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const tool = params.tools.find((t) => t.name === block.name);
          let output: unknown;
          try {
            output = tool
              ? await tool.execute(block.input as Record<string, unknown>)
              : { error: `Ferramenta desconhecida: ${block.name}` };
          } catch (error) {
            output = { error: error instanceof Error ? error.message : String(error) };
          }
          return { type: "tool_result" as const, tool_use_id: block.id, content: JSON.stringify(output) };
        }),
      );

      messages.push({ role: "user", content: toolResults });
    }

    this.logger.warn("Limite de turnos de ferramentas atingido sem resposta final do agente.");
    return "Desculpe, não consegui processar sua mensagem agora. Tente novamente em instantes ou fale com a recepção.";
  }

  /**
   * ANTHROPIC_MOCK_MODE=true skips the real Anthropic call entirely (no network
   * request, no cost) so the WhatsApp pipeline — webhook, conversation storage,
   * gateway send — can be tested end-to-end without API credits.
   */
  private buildMockReply(userMessage: string): string {
    this.logger.warn("ANTHROPIC_MOCK_MODE ativo — respondendo com mensagem simulada, sem chamar a Anthropic.");
    return `[resposta simulada — modo mock ativo] Recebi sua mensagem: "${userMessage}". Quando o modo mock for desativado, a IA da Anthropic responderá de verdade aqui.`;
  }
}

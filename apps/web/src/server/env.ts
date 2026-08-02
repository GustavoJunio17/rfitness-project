import { z } from "zod";
import { configError } from "@rfitness/core";

/**
 * Env validado uma vez por processo. Acessar `env.X` em vez de
 * `process.env.X` garante que um deploy sem variável obrigatória falhe na
 * primeira request com mensagem clara, em vez de estourar `undefined` no meio de
 * uma query.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória (pooler do Supabase)."),
  DIRECT_URL: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default("rfitness-uploads"),

  STOCK_EXPIRING_SOON_DAYS: z.coerce.number().int().positive().default(7),
  STOCK_STALE_AFTER_DAYS: z.coerce.number().int().positive().default(60),
  WHATSAPP_FOLLOWUP_AFTER_DAYS: z.coerce.number().int().positive().default(3),

  EVOLUTION_API_URL: z.string().default("http://localhost:8080"),
  EVOLUTION_API_KEY: z.string().default(""),

  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
  ANTHROPIC_MOCK_MODE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),

  CRON_SECRET: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Só os nomes das variáveis viajam na resposta — valor de env nunca sai
    // daqui. O detalhe completo fica no log do servidor.
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    // eslint-disable-next-line no-console
    console.error(
      "[env] configuração inválida:\n  " +
        parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n  "),
    );
    throw configError(
      `Servidor sem configuração: defina ${names.join(", ")} nas variáveis de ambiente do deploy.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Só para testes: descarta o cache entre casos que mexem em process.env. */
export function resetEnvCache(): void {
  cached = null;
}

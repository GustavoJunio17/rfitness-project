export default () => ({
  port: parseInt(process.env.API_PORT ?? "3001", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "insecure-dev-access-secret-change-me",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "insecure-dev-refresh-secret-change-me",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "supabase",
    localUploadsDir: process.env.LOCAL_UPLOADS_DIR ?? "uploads",
    localPublicBaseUrl: process.env.LOCAL_PUBLIC_BASE_URL ?? `http://localhost:${process.env.API_PORT ?? "3001"}/uploads`,
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "rfitness-uploads",
  },
  inventory: {
    expiringSoonDays: parseInt(process.env.STOCK_EXPIRING_SOON_DAYS ?? "7", 10),
    staleAfterDays: parseInt(process.env.STOCK_STALE_AFTER_DAYS ?? "60", 10),
  },
  whatsapp: {
    evolutionApiUrl: process.env.EVOLUTION_API_URL ?? "http://localhost:8080",
    evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "",
    webhookSharedSecret: process.env.EVOLUTION_API_KEY ?? "",
    followUpAfterDays: parseInt(process.env.WHATSAPP_FOLLOWUP_AFTER_DAYS ?? "3", 10),
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
    mockMode: process.env.ANTHROPIC_MOCK_MODE === "true",
  },
});

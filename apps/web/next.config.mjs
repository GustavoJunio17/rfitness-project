import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // O Router Cache do App Router reaproveita o payload de telas já visitadas
    // por 30s. Esse cache é do navegador e não pertence a sessão nenhuma: ao
    // trocar de conta na mesma aba, a shell renderizada para o usuário anterior
    // reaparecia. Zerar desliga a reutilização — que tela cada pessoa pode ver
    // depende de quem está logada, então nada aqui pode sobreviver à troca.
    staleTimes: { dynamic: 0, static: 0 },
  },
  // Os pacotes do workspace são publicados como TypeScript, sem build próprio.
  transpilePackages: ["@rfitness/core", "@rfitness/db"],
  // O Prisma carrega os engines nativos em runtime; empacotá-lo quebra o bundle
  // da função serverless.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Sem isto o tracing parte de `apps/web` e ignora o node_modules da raiz do
  // workspace: o engine nativo do Prisma fica de fora do bundle da função e o
  // client falha ao inicializar em runtime, sem código de erro.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    // As duas formas do glob de propósito: o caminho é resolvido a partir do
    // diretório do app em algumas versões e da raiz do tracing em outras.
    "/api/**/*": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node",
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/schema.prisma",
      "node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node",
      "node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/schema.prisma",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Os pacotes do workspace são publicados como TypeScript, sem build próprio.
  transpilePackages: ["@rfitness/core", "@rfitness/db"],
  // O Prisma carrega os engines nativos em runtime; empacotá-lo quebra o bundle
  // da função serverless.
  serverExternalPackages: ["@prisma/client", "prisma"],
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

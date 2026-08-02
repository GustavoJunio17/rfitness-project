import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DomainError } from "@rfitness/core";
import { defineRoute } from "./route";
import type { AuthContext } from "../auth/context";

const adminAuth: AuthContext = {
  authUserId: "auth-1",
  gymId: "gym-1",
  email: "admin@demo.com",
  name: "Admin",
  roles: ["ADMIN"],
};

const stockistAuth: AuthContext = { ...adminAuth, roles: ["STOCKIST"] };

const request = (url = "https://app.test/api/x", init?: RequestInit) => new Request(url, init);

const deps = (auth: AuthContext | null) => ({ getAuthContext: vi.fn().mockResolvedValue(auth) });

describe("defineRoute — autenticação", () => {
  it("responde 401 sem sessão", async () => {
    const handler = defineRoute({ handler: async () => ({ ok: true }) }, deps(null));
    const response = await handler(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Sessão inválida ou expirada." },
    });
  });

  it("libera rota pública sem sessão e sem consultar o Supabase", async () => {
    const routeDeps = deps(null);
    const handler = defineRoute({ public: true, handler: async () => ({ ok: true }) }, routeDeps);
    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(routeDeps.getAuthContext).not.toHaveBeenCalled();
  });

  it("responde 403 quando falta o papel exigido", async () => {
    const handler = defineRoute(
      { roles: ["ADMIN", "FINANCE"], handler: async () => ({ ok: true }) },
      deps(stockistAuth),
    );
    const response = await handler(request());

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("entrega o contexto autenticado ao handler", async () => {
    const handler = defineRoute({ handler: async ({ auth }) => ({ gymId: auth.gymId }) }, deps(adminAuth));
    const response = await handler(request());

    await expect(response.json()).resolves.toEqual({ gymId: "gym-1" });
  });
});

describe("defineRoute — validação", () => {
  const bodySchema = z.object({ quantity: z.number().int().positive() });

  it("valida e entrega o body tipado", async () => {
    const handler = defineRoute(
      { body: bodySchema, handler: async ({ body }) => ({ doubled: body.quantity * 2 }) },
      deps(adminAuth),
    );

    const response = await handler(
      request("https://app.test/api/x", {
        method: "POST",
        body: JSON.stringify({ quantity: 3 }),
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(response.json()).resolves.toEqual({ doubled: 6 });
  });

  it("responde 400 com as issues do zod", async () => {
    const handler = defineRoute({ body: bodySchema, handler: async () => ({}) }, deps(adminAuth));
    const response = await handler(
      request("https://app.test/api/x", {
        method: "POST",
        body: JSON.stringify({ quantity: -1 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("VALIDATION");
    expect(payload.error.details).toBeDefined();
  });

  it("responde 400 para JSON malformado", async () => {
    const handler = defineRoute({ body: bodySchema, handler: async () => ({}) }, deps(adminAuth));
    const response = await handler(
      request("https://app.test/api/x", {
        method: "POST",
        body: "{isso não é json",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("valida a query string", async () => {
    const handler = defineRoute(
      {
        query: z.object({ status: z.enum(["PENDING", "DELIVERED"]).optional() }),
        handler: async ({ query }) => ({ status: query.status ?? null }),
      },
      deps(adminAuth),
    );

    const ok = await handler(request("https://app.test/api/x?status=DELIVERED"));
    await expect(ok.json()).resolves.toEqual({ status: "DELIVERED" });

    const bad = await handler(request("https://app.test/api/x?status=SEI_LA"));
    expect(bad.status).toBe(400);
  });
});

describe("defineRoute — erros", () => {
  it("traduz DomainError para o status correspondente", async () => {
    const handler = defineRoute(
      {
        handler: async () => {
          throw new DomainError("NOT_FOUND", "Pedido não encontrado.");
        },
      },
      deps(adminAuth),
    );

    const response = await handler(request());
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Pedido não encontrado." },
    });
  });

  it("erro inesperado vira 500 sem vazar detalhe interno", async () => {
    const handler = defineRoute(
      {
        handler: async () => {
          throw new Error("connect ECONNREFUSED 10.0.0.1:5432");
        },
      },
      deps(adminAuth),
    );

    const response = await handler(request());
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error.code).toBe("INTERNAL");
    expect(JSON.stringify(payload)).not.toContain("ECONNREFUSED");
  });

  it("erro de infra do Prisma vira 503 acionável, sem expor a connection string", async () => {
    const handler = defineRoute(
      {
        handler: async () => {
          const error = Object.assign(new Error("Can't reach database server at db.abc.supabase.co:5432"), {
            code: "P1001",
          });
          throw error;
        },
      },
      deps(adminAuth),
    );

    const response = await handler(request());
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error.code).toBe("CONFIG");
    expect(payload.error.message).toMatch(/DATABASE_URL/);
    expect(JSON.stringify(payload)).not.toContain("supabase.co");
  });

  it("erro de inicialização do Prisma (errorCode, não code) também vira 503", async () => {
    const handler = defineRoute(
      {
        handler: async () => {
          // Formato de PrismaClientInitializationError.
          throw Object.assign(new Error("Can't reach database server at db.abc.supabase.co:5432"), {
            errorCode: "P1001",
          });
        },
      },
      deps(adminAuth),
    );

    const response = await handler(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CONFIG" } });
  });

  it("env ausente detectada pela mensagem do Prisma vira 503 nomeando a variável", async () => {
    const handler = defineRoute(
      {
        handler: async () => {
          throw new Error("error: Environment variable not found: DATABASE_URL.");
        },
      },
      deps(adminAuth),
    );

    const response = await handler(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CONFIG", message: expect.stringContaining("DATABASE_URL") },
    });
  });

  it("banco sem migration vira 503 dizendo o que rodar", async () => {
    const handler = defineRoute(
      {
        handler: async () => {
          throw Object.assign(new Error('relation "gyms" does not exist'), { code: "P2021" });
        },
      },
      deps(adminAuth),
    );

    const response = await handler(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CONFIG", message: expect.stringContaining("db:migrate:deploy") },
    });
  });

  it("falha de inicialização do Prisma expõe a causa sem a credencial da URL", async () => {
    const handler = defineRoute(
      {
        handler: async () => {
          const error = new Error(
            'Query engine library not found. datasource: postgresql://postgres.abc:s3nh4Secreta@aws-0.pooler.supabase.com:6543/postgres',
          );
          error.name = "PrismaClientInitializationError";
          throw error;
        },
      },
      deps(adminAuth),
    );

    const response = await handler(request());
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error.details.type).toBe("PrismaClientInitializationError");
    expect(payload.error.details.reason).toContain("Query engine library not found");
    expect(JSON.stringify(payload)).not.toContain("s3nh4Secreta");
  });

  it("204 quando o handler não devolve conteúdo", async () => {
    const handler = defineRoute({ handler: async () => undefined }, deps(adminAuth));
    const response = await handler(request());
    expect(response.status).toBe(204);
  });
});

describe("defineRoute — params de rota dinâmica", () => {
  it("resolve os params assíncronos do Next", async () => {
    const handler = defineRoute(
      {
        params: z.object({ id: z.string().uuid() }),
        handler: async ({ params }) => ({ id: params.id }),
      },
      deps(adminAuth),
    );

    const id = "11111111-1111-4111-8111-111111111111";
    const response = await handler(request(), { params: Promise.resolve({ id }) });
    await expect(response.json()).resolves.toEqual({ id });
  });

  it("responde 400 para param inválido", async () => {
    const handler = defineRoute(
      { params: z.object({ id: z.string().uuid() }), handler: async () => ({}) },
      deps(adminAuth),
    );

    const response = await handler(request(), { params: Promise.resolve({ id: "nao-e-uuid" }) });
    expect(response.status).toBe(400);
  });
});

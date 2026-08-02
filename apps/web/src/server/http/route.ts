import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { assertRole, isDomainError, type Role } from "@rfitness/core";
import { getAuthContext, type AuthContext } from "../auth/context";

export interface RouteDeps {
  getAuthContext: () => Promise<AuthContext | null>;
}

const defaultDeps: RouteDeps = { getAuthContext };

/** Segundo argumento que o Next passa para route handlers dinâmicos. */
export interface NextRouteArgs {
  params?: Promise<Record<string, string | string[]>>;
}

export interface RouteHandlerContext<TBody, TQuery, TParams> {
  request: Request;
  auth: AuthContext;
  body: TBody;
  query: TQuery;
  params: TParams;
}

export interface RouteSpec<TBody, TQuery, TParams> {
  /** Rota sem sessão (webhook, cron, health). Nunca combine com `roles`. */
  public?: boolean;
  roles?: Role[];
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  params?: ZodType<TParams>;
  handler: (context: RouteHandlerContext<TBody, TQuery, TParams>) => Promise<unknown>;
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/**
 * Falha de infra do Prisma tem código estável (`P1001`, `P2021`…). Sem esta
 * tradução, banco inacessível e banco sem migration caem no mesmo 500 genérico,
 * que não diz o que fazer. A mensagem cita o problema, nunca a connection string.
 */
function infraMessage(error: unknown): string | null {
  const code = (error as { code?: unknown })?.code;
  if (typeof code !== "string") return null;

  switch (code) {
    case "P1000":
    case "P1010":
      return "Banco de dados recusou a autenticação. Confira DATABASE_URL.";
    case "P1001":
    case "P1002":
      return "Não foi possível conectar ao banco de dados. Confira DATABASE_URL e se o projeto do Supabase está ativo.";
    case "P2021":
    case "P2022":
      return "O banco de dados ainda não foi migrado. Rode `pnpm db:migrate:deploy`.";
    default:
      return null;
  }
}

function queryToObject(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    result[key] = values.length > 1 ? values : (values[0] as string);
  }
  return result;
}

/**
 * Único ponto de entrada HTTP da aplicação. Concentra o que antes eram guards +
 * pipes + filtro de exceção do Nest:
 *
 *  1. sessão obrigatória por padrão (401) — `public: true` é explícito;
 *  2. RBAC por papel (403);
 *  3. validação de body/query/params com zod (400 com as issues);
 *  4. tradução de DomainError para status, e qualquer outro erro para 500
 *     genérico — mensagem interna nunca vaza para o cliente.
 */
export function defineRoute<TBody = undefined, TQuery = undefined, TParams = undefined>(
  spec: RouteSpec<TBody, TQuery, TParams>,
  deps: RouteDeps = defaultDeps,
) {
  return async function handle(request: Request, args?: NextRouteArgs): Promise<Response> {
    let auth: AuthContext | null = null;

    try {
      if (!spec.public) {
        auth = await deps.getAuthContext();
        if (!auth) {
          return errorResponse(401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
        }
        if (spec.roles?.length) {
          assertRole(auth.roles, spec.roles);
        }
      }

      const url = new URL(request.url);

      let body = undefined as TBody;
      if (spec.body) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return errorResponse(400, "VALIDATION", "Corpo da requisição não é um JSON válido.");
        }
        const parsed = spec.body.safeParse(raw);
        if (!parsed.success) {
          return errorResponse(400, "VALIDATION", "Dados inválidos.", z.treeifyError(parsed.error));
        }
        body = parsed.data;
      }

      let query = undefined as TQuery;
      if (spec.query) {
        const parsed = spec.query.safeParse(queryToObject(url));
        if (!parsed.success) {
          return errorResponse(400, "VALIDATION", "Parâmetros de busca inválidos.", z.treeifyError(parsed.error));
        }
        query = parsed.data;
      }

      let params = undefined as TParams;
      if (spec.params) {
        const rawParams = (await args?.params) ?? {};
        const parsed = spec.params.safeParse(rawParams);
        if (!parsed.success) {
          return errorResponse(400, "VALIDATION", "Parâmetro de rota inválido.", z.treeifyError(parsed.error));
        }
        params = parsed.data;
      }

      const result = await spec.handler({
        request,
        auth: auth as AuthContext,
        body,
        query,
        params,
      });

      if (result === undefined || result === null) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json(result);
    } catch (error) {
      if (isDomainError(error)) {
        return errorResponse(error.httpStatus, error.code, error.message, error.details);
      }

      // eslint-disable-next-line no-console
      console.error("[route] erro não tratado", error);

      const infra = infraMessage(error);
      if (infra) return errorResponse(503, "CONFIG", infra);

      return errorResponse(500, "INTERNAL", "Erro interno inesperado.");
    }
  };
}

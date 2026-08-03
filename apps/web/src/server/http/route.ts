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

/**
 * A quem a rota pertence:
 *
 *  * `gym` (padrão) — operação de uma academia. Exige academia ativa, e é o que
 *    garante que todo handler possa usar `auth.gymId` sem checar se está vazio.
 *  * `platform` — console da RFitness. Exige admin de plataforma.
 *  * `any` — só sessão válida (perfil, lista de academias, troca de unidade),
 *    usada por quem ainda não tem — ou não precisa de — academia ativa.
 */
export type RouteScope = "gym" | "platform" | "any";

export interface RouteSpec<TBody, TQuery, TParams> {
  /** Rota sem sessão (webhook, cron, health). Nunca combine com `roles`. */
  public?: boolean;
  scope?: RouteScope;
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
  // `PrismaClientKnownRequestError` usa `code`; `PrismaClientInitializationError`
  // — justamente a de banco inalcançável ou DATABASE_URL ausente — usa
  // `errorCode`. Olhar só um dos dois deixa o caso mais comum cair no 500 mudo.
  const source = error as { code?: unknown; errorCode?: unknown; message?: unknown };
  const code = typeof source?.code === "string" ? source.code : undefined;
  const errorCode = typeof source?.errorCode === "string" ? source.errorCode : undefined;
  const message = typeof source?.message === "string" ? source.message : "";

  switch (code ?? errorCode) {
    case "P1000":
    case "P1010":
      return "Banco de dados recusou a autenticação. Confira DATABASE_URL.";
    case "P1001":
    case "P1002":
      return "Não foi possível conectar ao banco de dados. Confira DATABASE_URL e se o projeto do Supabase está ativo.";
    case "P1003":
      return "O banco de dados informado em DATABASE_URL não existe.";
    case "P2021":
    case "P2022":
      return "O banco de dados ainda não foi migrado. Rode `pnpm db:migrate:deploy`.";
    default:
      break;
  }

  // Sem código: o Prisma sinaliza env ausente, URL malformada e schema não
  // migrado só no texto.
  if (/provided database string is invalid|arguments are not supported in database URL/i.test(message)) {
    return (
      "DATABASE_URL está malformada. Use apenas ?pgbouncer=true&connection_limit=1 " +
      "(o parâmetro supa=... que o Supabase inclui não é aceito pelo Prisma) e " +
      "escape caracteres especiais da senha: @ vira %40, # vira %23."
    );
  }
  if (/Environment variable not found/i.test(message)) {
    const missing = /Environment variable not found:\s*([A-Z0-9_]+)/i.exec(message)?.[1];
    return missing
      ? `Variável de ambiente ${missing} não está definida no deploy.`
      : "Falta uma variável de ambiente no deploy.";
  }
  // Só o texto do próprio Prisma: um ECONNREFUSED solto pode vir de qualquer
  // integração (Evolution, Anthropic) e apontaria para o banco sem motivo.
  if (/Can't reach database server|the database server at .* was reached/i.test(message)) {
    return "Não foi possível conectar ao banco de dados. Confira DATABASE_URL e se o projeto do Supabase está ativo.";
  }
  if (/does not exist in the current database|relation .* does not exist/i.test(message)) {
    return "O banco de dados ainda não foi migrado. Rode `pnpm db:migrate:deploy`.";
  }

  return null;
}

/**
 * Remove segredo de mensagem de erro antes de ela sair na resposta: credencial
 * embutida em URL (`postgres://user:senha@host`), chave de API e token JWT.
 */
function sanitizeMessage(message: string): string {
  return message
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1***@")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "***")
    .replace(/\b(sb|sk|pk|rk)_[A-Za-z0-9_-]{8,}/g, "***")
    .slice(0, 400);
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
        const scope = spec.scope ?? "gym";

        // Conta não liberada não opera nada. `any` continua passando porque é
        // por onde o cliente descobre o próprio estado (`/auth/me`) e por onde
        // ele troca a senha — negar aí deixaria a pessoa sem explicação.
        if (scope !== "any" && auth.accessStatus !== "APPROVED") {
          return errorResponse(
            403,
            "ACCOUNT_NOT_APPROVED",
            "Sua conta ainda precisa ser liberada pela administração da RFitness.",
          );
        }

        if (scope === "platform" && !auth.isPlatformAdmin) {
          return errorResponse(403, "FORBIDDEN", "Área restrita à administração da RFitness.");
        }

        // Código próprio, não 403 genérico: o cliente precisa distinguir "você
        // não pode" de "escolha uma academia primeiro" para mandar o gestor
        // recém-aprovado à tela certa em vez de a um erro sem saída.
        if (scope === "gym" && !auth.gymId) {
          return errorResponse(
            409,
            "NO_ACTIVE_GYM",
            "Nenhuma academia selecionada. Escolha ou cadastre uma academia para continuar.",
          );
        }

        // Papel é sempre da academia ativa; em rota de plataforma ele não existe
        // e exigir um seria negar acesso ao próprio admin da RFitness.
        if (spec.roles?.length && scope !== "platform") {
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

      // Classe e código da exceção viajam junto (nunca a mensagem, que pode
      // conter dado do banco ou da requisição): sem isso, um 500 em produção só
      // é diagnosticável com acesso ao log da função.
      const source = error as { name?: unknown; code?: unknown; errorCode?: unknown; message?: unknown };
      const type = typeof source?.name === "string" ? source.name : "Error";
      const details: { type: string; code: string | null; reason?: string } = {
        type,
        code:
          typeof source?.code === "string"
            ? source.code
            : typeof source?.errorCode === "string"
              ? source.errorCode
              : null,
      };

      // Falha de inicialização do Prisma não tem código: engine ausente no
      // bundle, env sem valor e URL malformada chegam todas iguais, e a causa
      // vive só no texto. Vai sanitizado — credencial de URL é apagada antes.
      if (type === "PrismaClientInitializationError" && typeof source.message === "string") {
        details.reason = sanitizeMessage(source.message);
      }

      return errorResponse(500, "INTERNAL", "Erro interno inesperado.", details);
    }
  };
}

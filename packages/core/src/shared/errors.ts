export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "CONFIG";

const HTTP_STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CONFIG: 503,
};

/**
 * Erro de regra de negócio. Vive no core (sem dependência de HTTP/Nest/Next) e é
 * traduzido para resposta HTTP na borda — ver `apps/web/src/server/http/handler.ts`.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, DomainError.prototype);
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export const validationError = (message: string, details?: unknown) =>
  new DomainError("VALIDATION", message, details);
export const notFoundError = (message: string) => new DomainError("NOT_FOUND", message);
export const conflictError = (message: string) => new DomainError("CONFLICT", message);
export const forbiddenError = (message: string) => new DomainError("FORBIDDEN", message);
export const unauthorizedError = (message: string) => new DomainError("UNAUTHORIZED", message);
/**
 * Ambiente/infra fora do ar ou mal configurado — culpa do servidor, não do
 * usuário. Vira 503 com mensagem acionável em vez de um 500 opaco.
 */
export const configError = (message: string) => new DomainError("CONFIG", message);

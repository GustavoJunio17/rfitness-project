const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends RequestInit {
  /** Rotas públicas (cadastro) — não redirecionam para o login em 401. */
  allowAnonymous?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    return new ApiError(
      response.status,
      body.error?.message ?? response.statusText,
      body.error?.code,
      body.error?.details,
    );
  } catch {
    return new ApiError(response.status, response.statusText);
  }
}

/**
 * Cliente HTTP da aplicação.
 *
 * Mesma origem da API (o app é um Next.js único), então a sessão viaja nos
 * cookies do Supabase — não há token no localStorage nem header Authorization
 * montado à mão, e o middleware renova a sessão a cada navegação.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { allowAnonymous, headers, body, ...rest } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    body,
    credentials: "same-origin",
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
  });

  if (response.status === 401 && !allowAnonymous && typeof window !== "undefined") {
    // Sessão expirada e não renovável: o middleware não conseguiu renovar, então
    // mandar para o login é o único caminho — tentar refresh aqui duplicaria a
    // lógica que o @supabase/ssr já faz.
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export function apiUpload<T>(path: string, file: File, fieldName = "file"): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);
  return apiFetch<T>(path, { method: "POST", body: formData });
}

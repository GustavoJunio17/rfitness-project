import { useAuthStore } from "@/store/auth-store";

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  /** Internal: prevents infinite refresh loops. */
  _retried?: boolean;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function refreshSession(): Promise<boolean> {
  const { refreshToken, user, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken || !user) return false;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return false;
  }

  const data = await response.json();
  setSession(data);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, _retried, headers, ...rest } = options;
  const accessToken = useAuthStore.getState().accessToken;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (response.status === 401 && !skipAuth && !_retried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  gym: { id: string; name: string; slug: string; whatsappInstanceName: string | null };
}

/** Perfil e papéis do usuário logado, servidos por /api/auth/me. */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionUser>("/auth/me"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Checagem de papel na UI — a autorização de verdade é sempre do servidor. */
export function useHasRole(...roles: string[]): boolean {
  const { data } = useSession();
  if (!data) return false;
  if (roles.length === 0) return true;
  return data.roles.some((role) => roles.includes(role));
}

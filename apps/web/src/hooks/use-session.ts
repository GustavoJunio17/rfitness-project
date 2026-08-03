"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface GymMembership {
  gymId: string;
  gymName: string;
  gymSlug: string;
  roles: string[];
}

export interface SessionUser {
  /** Perfil na academia ativa; `null` para admin de plataforma sem academia. */
  id: string | null;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  roles: string[];
  gym: { id: string; name: string; slug: string; whatsappInstanceName: string | null } | null;
  memberships: GymMembership[];
}

/** Perfil, papéis e rede de academias do usuário logado, servidos por /api/auth/me. */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionUser>("/auth/me"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Troca a academia ativa.
 *
 * Limpa o cache inteiro em vez de invalidar chave por chave: quase todo dado
 * carregado pertence ao tenant anterior, e mostrar número de outra unidade por
 * um frame é pior que um recarregamento.
 */
export function useSwitchGym() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gymId: string) =>
      apiFetch<GymMembership>("/auth/active-gym", {
        method: "POST",
        body: JSON.stringify({ gymId }),
      }),
    onSuccess: () => queryClient.clear(),
  });
}

/** Checagem de papel na UI — a autorização de verdade é sempre do servidor. */
export function useHasRole(...roles: string[]): boolean {
  const { data } = useSession();
  if (!data) return false;
  if (roles.length === 0) return true;
  return data.roles.some((role) => roles.includes(role));
}

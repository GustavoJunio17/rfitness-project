"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Gym {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isOwner: boolean;
  roles: string[];
  createdAt: string;
  counts: { students: number; products: number; users: number };
}

/** Academias da rede do gestor logado. */
export function useMyGyms() {
  return useQuery({
    queryKey: ["gyms"],
    queryFn: () => apiFetch<Gym[]>("/gyms"),
  });
}

export function useCreateGym() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Gym>("/gyms", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
      // A sessão carrega a lista de vínculos: sem invalidar, a academia nova não
      // apareceria no seletor até o próximo refresh.
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

export function useUpdateGym() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; isActive?: boolean }) =>
      apiFetch<Gym>(`/gyms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

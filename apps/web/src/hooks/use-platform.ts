"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type ManagerAccountStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

export interface ManagerAccount {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: ManagerAccountStatus;
  decisionReason: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  createdAt: string;
  gyms: { id: string; name: string; isOwner: boolean }[];
}

export interface PlatformGym {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  owner: { accountId: string | null; name: string; email: string } | null;
  managers: { accountId: string | null; name: string; email: string; isOwner: boolean }[];
  counts: { students: number; products: number; users: number };
}

export interface PlatformOverview {
  gyms: { total: number; active: number };
  accounts: { total: number; pending: number; active: number; blocked: number };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GymOption {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Tudo do console sai do mesmo par de listas, e quase toda ação mexe nas duas
 * — mudar o dono de uma academia altera a linha do gestor também. Invalidar em
 * bloco evita a tela mostrar metade do efeito.
 */
function useConsoleMutation<TData, TVariables>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of [
        "platform-accounts",
        "platform-account",
        "platform-gyms",
        "platform-gym",
        "platform-gym-options",
        "platform-overview",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function usePlatformOverview() {
  return useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => apiFetch<PlatformOverview>("/platform/overview"),
  });
}

function toQuery(filter: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useManagerAccounts(
  filter: { status?: ManagerAccountStatus; search?: string; page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: [
      "platform-accounts",
      filter.status ?? "all",
      filter.search ?? "",
      filter.page ?? 1,
      filter.pageSize ?? 20,
    ],
    queryFn: () => apiFetch<Page<ManagerAccount>>(`/platform/accounts${toQuery(filter)}`),
  });
}

/**
 * Detalhe da conta.
 *
 * Consulta própria em vez de reaproveitar a linha da lista: o painel fica
 * aberto enquanto se concede acesso a academias, e o objeto capturado no clique
 * não acompanharia essas mudanças.
 */
export function useManagerAccount(id: string | null) {
  return useQuery({
    queryKey: ["platform-account", id],
    queryFn: () => apiFetch<ManagerAccount>(`/platform/accounts/${id}`),
    enabled: id !== null,
  });
}

export function useGymOptions() {
  return useQuery({
    queryKey: ["platform-gym-options"],
    queryFn: () => apiFetch<GymOption[]>("/platform/gyms/options"),
  });
}

export function useCreateManagerAccount() {
  return useConsoleMutation((input: { name: string; email: string; password: string; phone?: string }) =>
    apiFetch<ManagerAccount>("/platform/accounts", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdateManagerAccount() {
  return useConsoleMutation(
    ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      phone?: string | null;
      notes?: string | null;
      status?: ManagerAccountStatus;
      decisionReason?: string | null;
    }) =>
      apiFetch<ManagerAccount>(`/platform/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  );
}

export function useSetAccountPassword() {
  return useConsoleMutation(({ id, password }: { id: string; password: string }) =>
    apiFetch<void>(`/platform/accounts/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),
  );
}

export function useDeleteManagerAccount() {
  return useConsoleMutation((id: string) =>
    apiFetch<void>(`/platform/accounts/${id}`, { method: "DELETE" }),
  );
}

export function usePlatformGyms(filter: { search?: string; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ["platform-gyms", filter.search ?? "", filter.page ?? 1, filter.pageSize ?? 20],
    queryFn: () => apiFetch<Page<PlatformGym>>(`/platform/gyms${toQuery(filter)}`),
  });
}

export function usePlatformGym(id: string | null) {
  return useQuery({
    queryKey: ["platform-gym", id],
    queryFn: () => apiFetch<PlatformGym>(`/platform/gyms/${id}`),
    enabled: id !== null,
  });
}

export function useCreatePlatformGym() {
  return useConsoleMutation((input: { name: string; ownerAccountId?: string | null }) =>
    apiFetch<{ id: string }>("/platform/gyms", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdatePlatformGym() {
  return useConsoleMutation(
    ({ id, ...body }: { id: string; name?: string; isActive?: boolean; ownerAccountId?: string }) =>
      apiFetch<void>(`/platform/gyms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
}

export function useDeletePlatformGym() {
  return useConsoleMutation((id: string) =>
    apiFetch<void>(`/platform/gyms/${id}`, { method: "DELETE" }),
  );
}

export function useGrantGymAccess() {
  return useConsoleMutation(({ gymId, accountId }: { gymId: string; accountId: string }) =>
    apiFetch<void>(`/platform/gyms/${gymId}/managers`, {
      method: "POST",
      body: JSON.stringify({ accountId }),
    }),
  );
}

export function useRevokeGymAccess() {
  return useConsoleMutation(({ gymId, accountId }: { gymId: string; accountId: string }) =>
    apiFetch<void>(`/platform/gyms/${gymId}/managers/${accountId}`, { method: "DELETE" }),
  );
}

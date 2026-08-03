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
      queryClient.invalidateQueries({ queryKey: ["platform-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["platform-gyms"] });
      queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
    },
  });
}

export function usePlatformOverview() {
  return useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => apiFetch<PlatformOverview>("/platform/overview"),
  });
}

export function useManagerAccounts(filter: { status?: ManagerAccountStatus; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.search) params.set("search", filter.search);
  const query = params.toString();

  return useQuery({
    queryKey: ["platform-accounts", filter.status ?? "all", filter.search ?? ""],
    queryFn: () => apiFetch<ManagerAccount[]>(`/platform/accounts${query ? `?${query}` : ""}`),
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

export function usePlatformGyms() {
  return useQuery({
    queryKey: ["platform-gyms"],
    queryFn: () => apiFetch<PlatformGym[]>("/platform/gyms"),
  });
}

export function useCreatePlatformGym() {
  return useConsoleMutation((input: { name: string; ownerAccountId: string }) =>
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

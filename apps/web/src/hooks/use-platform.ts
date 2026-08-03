"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AccessRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  phone: string | null;
  gymName: string;
  notes: string | null;
  status: AccessRequestStatus;
  decisionReason: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  createdGymId: string | null;
  createdAt: string;
}

export interface ApprovalResult {
  gymId: string;
  gymName: string;
  email: string;
}

export interface PlatformGym {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  owner: { name: string; email: string } | null;
  counts: { students: number; products: number; users: number };
}

export interface PlatformOverview {
  gyms: { total: number; active: number };
  managers: number;
  requests: { pending: number; approved: number; rejected: number };
}

export function usePlatformOverview() {
  return useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => apiFetch<PlatformOverview>("/platform/overview"),
  });
}

export function useAccessRequests(status?: AccessRequestStatus) {
  return useQuery({
    queryKey: ["access-requests", status ?? "all"],
    queryFn: () =>
      apiFetch<AccessRequest[]>(`/platform/access-requests${status ? `?status=${status}` : ""}`),
  });
}

export function usePlatformGyms() {
  return useQuery({
    queryKey: ["platform-gyms"],
    queryFn: () => apiFetch<PlatformGym[]>("/platform/gyms"),
  });
}

/**
 * Decidir um pedido mexe nas três telas do console (fila, contadores e lista de
 * academias) — invalidar as três em um lugar só evita esquecer uma.
 */
function useDecisionMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
      queryClient.invalidateQueries({ queryKey: ["platform-gyms"] });
    },
  });
}

export function useApproveAccessRequest() {
  return useDecisionMutation((id: string) =>
    apiFetch<ApprovalResult>(`/platform/access-requests/${id}/approve`, { method: "POST" }),
  );
}

export function useRejectAccessRequest() {
  return useDecisionMutation(({ id, reason }: { id: string; reason: string }) =>
    apiFetch<AccessRequest>(`/platform/access-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  );
}

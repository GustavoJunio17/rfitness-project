import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { StockAlert, StockMovementType } from "@/types/catalog";

export interface RegisterMovementInput {
  variantId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
}

export function useRegisterMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterMovementInput) =>
      apiFetch("/inventory/movements", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-alerts"] });
    },
  });
}

export function useStockAlerts(resolved: boolean) {
  return useQuery({
    queryKey: ["stock-alerts", resolved],
    queryFn: () => apiFetch<StockAlert[]>(`/inventory/alerts?resolved=${resolved}`),
    refetchInterval: 30_000,
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => apiFetch(`/inventory/alerts/${alertId}/resolve`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-alerts"] }),
  });
}

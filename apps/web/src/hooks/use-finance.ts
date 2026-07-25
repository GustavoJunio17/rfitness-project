import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  CashFlowEntry,
  FinanceSummary,
  HeatmapCell,
  PaymentMethodBreakdownEntry,
  RevenueSeriesPoint,
  TopProduct,
} from "@/types/finance";

export function useFinanceSummary() {
  return useQuery({
    queryKey: ["finance-summary"],
    queryFn: () => apiFetch<FinanceSummary>("/finance/summary"),
  });
}

export function useRevenueSeries(days = 30) {
  return useQuery({
    queryKey: ["finance-revenue-series", days],
    queryFn: () => apiFetch<RevenueSeriesPoint[]>(`/finance/revenue-series?days=${days}`),
  });
}

export function useTopProducts(limit = 5, order: "asc" | "desc" = "desc") {
  return useQuery({
    queryKey: ["finance-top-products", limit, order],
    queryFn: () => apiFetch<TopProduct[]>(`/finance/top-products?limit=${limit}&order=${order}`),
  });
}

export function usePaymentMethodBreakdown() {
  return useQuery({
    queryKey: ["finance-payment-breakdown"],
    queryFn: () => apiFetch<PaymentMethodBreakdownEntry[]>("/finance/payment-methods-breakdown"),
  });
}

export function useSalesHeatmap(days = 30) {
  return useQuery({
    queryKey: ["finance-heatmap", days],
    queryFn: () => apiFetch<HeatmapCell[]>(`/finance/sales-heatmap?days=${days}`),
  });
}

export function useCashFlow() {
  return useQuery({
    queryKey: ["finance-cash-flow"],
    queryFn: () => apiFetch<CashFlowEntry[]>("/finance/cash-flow"),
  });
}

export interface CreateCashFlowEntryInput {
  description: string;
  amount: number;
  category: string;
}

export function useCreateCashFlowEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCashFlowEntryInput) =>
      apiFetch("/finance/cash-flow", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-cash-flow"] }),
  });
}

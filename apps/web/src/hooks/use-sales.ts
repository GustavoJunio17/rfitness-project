import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PaymentMethodType, Sale } from "@/types/sales";

export function useSales() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: () => apiFetch<Sale[]>("/sales"),
  });
}

export interface CreateSaleInput {
  studentId?: string;
  paymentMethod: PaymentMethodType;
  discount?: number;
  items: { variantId: string; quantity: number }[];
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSaleInput) =>
      apiFetch<Sale>("/sales", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-alerts"] });
    },
  });
}

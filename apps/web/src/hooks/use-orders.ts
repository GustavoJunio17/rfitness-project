import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { DeliveryType, Order, OrderDetail, OrderStatus } from "@/types/orders";
import type { PaymentMethodType } from "@/types/sales";

export function useOrders(status?: OrderStatus) {
  return useQuery({
    queryKey: ["orders", status ?? "all"],
    queryFn: () => apiFetch<Order[]>(`/orders${status ? `?status=${status}` : ""}`),
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${id}`),
    enabled: Boolean(id),
  });
}

export function useOpenOrdersCount() {
  return useQuery({
    queryKey: ["orders-open-count"],
    // A rota devolve `{ count }`, não o número solto. O tipo declarado dizia
    // `number`, então o TypeScript não reclamava e a tela imprimia o objeto.
    queryFn: async () => (await apiFetch<{ count: number }>("/orders/open-count")).count,
  });
}

export interface CreateOrderInput {
  studentId?: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethodType;
  notes?: string;
  items: { variantId: string; quantity: number }[];
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) =>
      apiFetch<Order>("/orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-open-count"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      apiFetch<Order>(`/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders-open-count"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-alerts"] });
    },
  });
}

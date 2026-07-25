import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ConversationDetail, ConversationSummary } from "@/types/whatsapp";

export function useConversations() {
  return useQuery({
    queryKey: ["whatsapp-conversations"],
    queryFn: () => apiFetch<ConversationSummary[]>("/whatsapp/conversations"),
    refetchInterval: 15_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["whatsapp-conversation", id],
    queryFn: () => apiFetch<ConversationDetail>(`/whatsapp/conversations/${id}`),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });
}

export function useUpdateWhatsAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (whatsappInstanceName: string) =>
      apiFetch("/whatsapp/settings", { method: "PATCH", body: JSON.stringify({ whatsappInstanceName }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] }),
  });
}

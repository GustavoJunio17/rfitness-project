"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSession } from "./use-session";

/**
 * Mapa evento → queries a invalidar. O payload do canal carrega apenas o tipo e
 * ids: o dado sensível é sempre rebuscado pela rota REST, que aplica RBAC.
 */
const QUERY_KEYS_BY_EVENT: Record<string, string[][]> = {
  "sale.created": [
    ["products"],
    ["sales"],
    ["finance-summary"],
    ["finance-revenue-series"],
    ["finance-top-products"],
    ["finance-payment-breakdown"],
    ["finance-cash-flow"],
    ["stock-alerts"],
  ],
  "stock.movement.created": [["products"], ["stock-movements"], ["stock-alerts"], ["finance-summary"]],
  "stock.alert.created": [["stock-alerts"], ["finance-summary"]],
  "stock.alert.resolved": [["stock-alerts"], ["finance-summary"]],
  "student.created": [["students"], ["finance-summary"]],
  "order.created": [["orders"], ["orders-open-count"]],
  "order.status_changed": [["orders"], ["orders-open-count"], ["products"], ["stock-alerts"]],
  "whatsapp.message.received": [["whatsapp-conversations"], ["whatsapp-conversation"]],
  "notification.created": [["notifications"], ["notifications-unread-count"]],
};

/**
 * Tempo real via Supabase Realtime (Postgres Changes na tabela
 * `realtime_events`), montado uma vez no layout do dashboard.
 *
 * Não existe servidor WebSocket próprio: na Vercel não haveria onde manter a
 * conexão. O servidor insere um sinal, o Supabase entrega ao browser e o React
 * Query refaz a chamada REST correspondente.
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const gymId = session?.gym.id;

  useEffect(() => {
    if (!gymId) return undefined;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`rfitness:gym:${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "realtime_events",
          filter: `gymId=eq.${gymId}`,
        },
        (payload) => {
          const type = (payload.new as { type?: string } | null)?.type;
          if (!type) return;

          for (const queryKey of QUERY_KEYS_BY_EVENT[type] ?? []) {
            queryClient.invalidateQueries({ queryKey });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gymId, queryClient]);
}

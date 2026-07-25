"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { disconnectSocket, getSocket } from "@/lib/socket";

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
  "stock.alert.created": [["stock-alerts"], ["finance-summary"]],
  "stock.alert.resolved": [["stock-alerts"], ["finance-summary"]],
  "stock.movement.created": [["products"], ["stock-alerts"], ["finance-summary"]],
  "order.created": [["orders"], ["orders-open-count"]],
  "order.status_changed": [["orders"], ["orders-open-count"], ["products"], ["stock-alerts"]],
  "notification.created": [["notifications"], ["notifications-unread-count"]],
};

/** Mounted once in the dashboard layout — reacts to realtime signals by refetching
 * through the normal authenticated REST hooks, never trusting data from the socket
 * payload itself (see apps/api/src/shared/realtime/realtime.service.ts). */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) return undefined;

    const socket = getSocket(accessToken);
    const events = Object.keys(QUERY_KEYS_BY_EVENT);
    const handlers = new Map<string, () => void>();

    for (const event of events) {
      const handler = () => {
        for (const queryKey of QUERY_KEYS_BY_EVENT[event]) {
          queryClient.invalidateQueries({ queryKey });
        }
      };
      handlers.set(event, handler);
      socket.on(event, handler);
    }

    return () => {
      for (const event of events) {
        const handler = handlers.get(event);
        if (handler) socket.off(event, handler);
      }
    };
  }, [accessToken, queryClient]);

  useEffect(() => {
    if (!accessToken) disconnectSocket();
  }, [accessToken]);
}

"use client";

import { useRealtimeInvalidation } from "@/hooks/use-realtime-invalidation";

/**
 * Componente sem UI que mantém a assinatura do Supabase Realtime viva enquanto o
 * dashboard está montado. Existe porque o layout é Server Component e hooks só
 * rodam no cliente.
 */
export function RealtimeBridge() {
  useRealtimeInvalidation();
  return null;
}

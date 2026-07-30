import { prisma } from "../db";
import { sanitizeSignalPayload, type RealtimeEventType } from "./signal";

/**
 * Publica um sinal para os clientes da academia.
 *
 * Implementação: insere em `realtime_events`; o browser está assinando essa
 * tabela via Supabase Realtime (Postgres Changes) com RLS por `gymId`. Nada de
 * WebSocket próprio — na Vercel não haveria onde manter a conexão.
 *
 * Best-effort de propósito: uma venda já gravada não pode virar erro 500 porque
 * a publicação do sinal falhou.
 */
export async function publishRealtime(
  gymId: string,
  type: RealtimeEventType,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.realtimeEvent.create({
      data: { gymId, type, payload: sanitizeSignalPayload(payload) },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[realtime] falha ao publicar ${type} para ${gymId}:`, error);
  }
}

/** Limpa sinais antigos — chamado pelo cron diário. */
export async function pruneRealtimeEvents(olderThanMinutes = 60): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const { count } = await prisma.realtimeEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

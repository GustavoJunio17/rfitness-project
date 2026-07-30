export const REALTIME_EVENT_TYPES = [
  "sale.created",
  "stock.movement.created",
  "stock.alert.created",
  "stock.alert.resolved",
  "student.created",
  "order.created",
  "order.status_changed",
  "whatsapp.message.received",
  "notification.created",
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export type SignalPayload = Record<string, string | number | boolean>;

const MAX_STRING_LENGTH = 120;

/**
 * Chaves que jamais devem trafegar no canal de tempo real. O browser recebe o
 * sinal e refaz a chamada REST, que aplica RBAC — se um valor de faturamento
 * viajasse no payload, quem não tem papel FINANCE veria número de lucro sem
 * passar por autorização nenhuma.
 */
const FORBIDDEN_KEYS = new Set([
  "amount",
  "totalamount",
  "totalprofit",
  "profit",
  "revenue",
  "price",
  "costprice",
  "saleprice",
  "unitprice",
  "unitcost",
  "discount",
  "balance",
  "ticket",
  "cpf",
  "phone",
  "email",
  "password",
]);

export function sanitizeSignalPayload(payload?: Record<string, unknown> | null): SignalPayload {
  if (!payload) return {};

  const safe: SignalPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      safe[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
    // objetos/arrays são descartados de propósito: sinal é plano.
  }

  return safe;
}

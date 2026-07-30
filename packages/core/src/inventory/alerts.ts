export type AlertDecision = "OPEN" | "RESOLVE" | "NOOP";

const DAY_MS = 86_400_000;

/**
 * Regra única de estoque baixo, compartilhada por movimentação de estoque, venda
 * e entrega de pedido — se cada caller reimplementasse isso, um deles ficaria
 * fora de sincronia.
 */
export function decideLowStockAlert(input: {
  minQuantity: number;
  currentQuantity: number;
  hasOpenAlert: boolean;
}): AlertDecision {
  const isLow = input.currentQuantity <= input.minQuantity;
  if (isLow && !input.hasOpenAlert) return "OPEN";
  if (!isLow && input.hasOpenAlert) return "RESOLVE";
  return "NOOP";
}

/**
 * Alertas temporais de validade. EXPIRED e EXPIRING_SOON são mutuamente
 * exclusivos: item vencido não é "vencendo em breve", então o segundo é resolvido
 * quando o primeiro abre.
 */
export function decideExpiryAlerts(input: {
  expiresAt: Date | null;
  now: Date;
  expiringSoonDays: number;
  hasOpenExpired: boolean;
  hasOpenExpiringSoon: boolean;
}): { expired: AlertDecision; expiringSoon: AlertDecision } {
  const { expiresAt, now, expiringSoonDays, hasOpenExpired, hasOpenExpiringSoon } = input;

  if (!expiresAt) {
    return {
      expired: hasOpenExpired ? "RESOLVE" : "NOOP",
      expiringSoon: hasOpenExpiringSoon ? "RESOLVE" : "NOOP",
    };
  }

  const isExpired = expiresAt.getTime() <= now.getTime();
  const threshold = now.getTime() + expiringSoonDays * DAY_MS;
  const isExpiringSoon = !isExpired && expiresAt.getTime() <= threshold;

  return {
    expired: isExpired ? (hasOpenExpired ? "NOOP" : "OPEN") : hasOpenExpired ? "RESOLVE" : "NOOP",
    expiringSoon: isExpiringSoon
      ? hasOpenExpiringSoon
        ? "NOOP"
        : "OPEN"
      : hasOpenExpiringSoon
        ? "RESOLVE"
        : "NOOP",
  };
}

/**
 * Produto parado: nenhuma movimentação na janela. SKU sem movimentação nenhuma
 * usa a data de criação como referência, senão todo SKU novo nasceria "parado".
 */
export function decideStaleAlert(input: {
  lastMovementAt: Date | null;
  createdAt?: Date;
  now: Date;
  staleAfterDays: number;
  hasOpenAlert: boolean;
}): AlertDecision {
  const reference = input.lastMovementAt ?? input.createdAt ?? null;
  if (!reference) return input.hasOpenAlert ? "RESOLVE" : "NOOP";

  const cutoff = input.now.getTime() - input.staleAfterDays * DAY_MS;
  const isStale = reference.getTime() <= cutoff;

  if (isStale && !input.hasOpenAlert) return "OPEN";
  if (!isStale && input.hasOpenAlert) return "RESOLVE";
  return "NOOP";
}

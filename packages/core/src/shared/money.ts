/**
 * Dinheiro é sempre número com 2 casas neste domínio (o banco guarda
 * Decimal(10,2)). Toda soma/multiplicação passa por aqui para não acumular erro
 * de ponto flutuante — `0.1 + 0.2` nunca deve virar `0.30000000000000004` numa
 * linha de venda.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumMoney(...values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}

export function multiplyMoney(price: number, quantity: number): number {
  return round2(price * quantity);
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

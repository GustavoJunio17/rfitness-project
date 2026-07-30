import { describe, expect, it } from "vitest";
import { round2, sumMoney, multiplyMoney } from "./money";

describe("round2", () => {
  it("arredonda para duas casas", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("não introduz erro de ponto flutuante em somas repetidas", () => {
    let total = 0;
    for (let i = 0; i < 10; i += 1) total = sumMoney(total, 0.1);
    expect(total).toBe(1);
  });
});

describe("multiplyMoney", () => {
  it("multiplica preço por quantidade com precisão de centavos", () => {
    expect(multiplyMoney(19.99, 3)).toBe(59.97);
    expect(multiplyMoney(0.07, 3)).toBe(0.21);
  });
});

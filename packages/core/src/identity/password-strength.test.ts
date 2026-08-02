import { describe, expect, it } from "vitest";
import { evaluatePassword } from "./password-strength";

describe("evaluatePassword", () => {
  it("trata senha vazia como neutra, sem acusar erro ainda", () => {
    const result = evaluatePassword("");
    expect(result.score).toBe(0);
    expect(result.acceptable).toBe(false);
    expect(result.hint).toBeNull();
  });

  it("não passa de fraca sem os requisitos obrigatórios", () => {
    expect(evaluatePassword("abcdefgh").acceptable).toBe(false);
    expect(evaluatePassword("abcdefgh").score).toBeLessThanOrEqual(1);
    expect(evaluatePassword("Senha123").acceptable).toBe(false); // sem símbolo
  });

  it("aceita senha com tamanho, caixas, número e símbolo", () => {
    const result = evaluatePassword("Trapo#Nuvem7");
    expect(result.acceptable).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it("rebaixa senhas comuns mesmo quando parecem complexas", () => {
    const result = evaluatePassword("password123");
    expect(result.acceptable).toBe(false);
    expect(result.hint).toMatch(/vazamentos/);
  });

  it("rebaixa senha derivada do nome, e-mail ou academia", () => {
    const result = evaluatePassword("Gustavo#2024", ["Gustavo Junio", "gustavo@ex.com", "Bora Bill"]);
    expect(result.acceptable).toBe(false);
    expect(result.hint).toMatch(/nome/);
  });

  it("penaliza sequências e repetições", () => {
    expect(evaluatePassword("Abcd#1234").score).toBeLessThan(evaluatePassword("Trapo#Nuvem7").score);
    expect(evaluatePassword("Aaaa#1111").acceptable).toBe(true);
    expect(evaluatePassword("Aaaa#1111").score).toBeLessThan(4);
  });

  it("marca cada requisito individualmente", () => {
    const requirements = evaluatePassword("abc").requirements;
    expect(requirements.find((r) => r.id === "length")?.met).toBe(false);
    expect(requirements.find((r) => r.id === "case")?.met).toBe(false);
    expect(requirements.find((r) => r.id === "number")?.met).toBe(false);
    expect(requirements.find((r) => r.id === "symbol")?.met).toBe(false);
  });
});

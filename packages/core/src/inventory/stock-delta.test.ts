import { describe, expect, it } from "vitest";
import { computeStockDelta } from "./stock-delta";
import { DomainError } from "../shared/errors";

describe("computeStockDelta", () => {
  it("IN soma a quantidade informada", () => {
    expect(computeStockDelta("IN", 10, 5)).toBe(10);
  });

  it("OUT, SALE, LOSS e EXPIRATION subtraem", () => {
    for (const type of ["OUT", "SALE", "LOSS", "EXPIRATION"] as const) {
      expect(computeStockDelta(type, 4, 10)).toBe(-4);
    }
  });

  it("EXCHANGE aceita delta nos dois sentidos", () => {
    expect(computeStockDelta("EXCHANGE", 3, 10)).toBe(3);
    expect(computeStockDelta("EXCHANGE", -3, 10)).toBe(-3);
  });

  it("INVENTORY_ADJUSTMENT trata a quantidade como a contagem física nova", () => {
    expect(computeStockDelta("INVENTORY_ADJUSTMENT", 8, 10)).toBe(-2);
    expect(computeStockDelta("INVENTORY_ADJUSTMENT", 12, 10)).toBe(2);
    expect(computeStockDelta("INVENTORY_ADJUSTMENT", 0, 10)).toBe(-10);
  });

  it("rejeita quantidade não positiva em IN e em saídas", () => {
    expect(() => computeStockDelta("IN", 0, 5)).toThrow(DomainError);
    expect(() => computeStockDelta("IN", -1, 5)).toThrow(/positiva/i);
    expect(() => computeStockDelta("OUT", 0, 5)).toThrow(DomainError);
    expect(() => computeStockDelta("SALE", -2, 5)).toThrow(DomainError);
  });

  it("rejeita quantidade fracionada", () => {
    expect(() => computeStockDelta("IN", 1.5, 5)).toThrow(/inteira/i);
  });

  it("rejeita contagem de inventário negativa", () => {
    expect(() => computeStockDelta("INVENTORY_ADJUSTMENT", -1, 5)).toThrow(DomainError);
  });
});

describe("computeStockDelta — resultado do estoque", () => {
  it("permite zerar o estoque", () => {
    expect(computeStockDelta("OUT", 5, 5)).toBe(-5);
  });
});

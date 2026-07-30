import { describe, expect, it } from "vitest";
import { mergeCartItems, computeSaleTotals } from "./sale-totals";
import { DomainError } from "../shared/errors";

const variant = (id: string, salePrice: number, costPrice: number, currentQuantity: number) => ({
  id,
  sku: `SKU-${id}`,
  salePrice,
  costPrice,
  currentQuantity,
  minQuantity: 0,
});

describe("mergeCartItems", () => {
  it("soma quantidades do mesmo SKU", () => {
    expect(
      mergeCartItems([
        { variantId: "a", quantity: 2 },
        { variantId: "b", quantity: 1 },
        { variantId: "a", quantity: 3 },
      ]),
    ).toEqual([
      { variantId: "a", quantity: 5 },
      { variantId: "b", quantity: 1 },
    ]);
  });

  it("preserva a ordem de primeira aparição", () => {
    const merged = mergeCartItems([
      { variantId: "z", quantity: 1 },
      { variantId: "a", quantity: 1 },
    ]);
    expect(merged.map((item) => item.variantId)).toEqual(["z", "a"]);
  });

  it("rejeita carrinho vazio", () => {
    expect(() => mergeCartItems([])).toThrow(DomainError);
  });

  it("rejeita quantidade não positiva ou fracionada", () => {
    expect(() => mergeCartItems([{ variantId: "a", quantity: 0 }])).toThrow(/positiva/i);
    expect(() => mergeCartItems([{ variantId: "a", quantity: 1.5 }])).toThrow(/inteira/i);
  });
});

describe("computeSaleTotals", () => {
  it("calcula subtotal, total e lucro sem desconto", () => {
    const result = computeSaleTotals({
      items: [
        { variantId: "a", quantity: 2 },
        { variantId: "b", quantity: 1 },
      ],
      variants: [variant("a", 100, 60, 10), variant("b", 50, 20, 10)],
      discount: 0,
    });

    expect(result.subtotal).toBe(250);
    expect(result.totalAmount).toBe(250);
    expect(result.totalProfit).toBe(110);
    expect(result.lines).toEqual([
      { variantId: "a", quantity: 2, unitPrice: 100, unitCost: 60, resultingQuantity: 8 },
      { variantId: "b", quantity: 1, unitPrice: 50, unitCost: 20, resultingQuantity: 9 },
    ]);
  });

  it("desconto sai integralmente da margem", () => {
    const result = computeSaleTotals({
      items: [{ variantId: "a", quantity: 1 }],
      variants: [variant("a", 100, 60, 10)],
      discount: 10,
    });

    expect(result.subtotal).toBe(100);
    expect(result.totalAmount).toBe(90);
    expect(result.totalProfit).toBe(30);
  });

  it("funde itens duplicados antes de validar estoque", () => {
    const result = computeSaleTotals({
      items: [
        { variantId: "a", quantity: 3 },
        { variantId: "a", quantity: 2 },
      ],
      variants: [variant("a", 10, 4, 5)],
      discount: 0,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ quantity: 5, resultingQuantity: 0 });
    expect(result.subtotal).toBe(50);
  });

  it("rejeita venda quando a soma dos itens duplicados excede o estoque", () => {
    expect(() =>
      computeSaleTotals({
        items: [
          { variantId: "a", quantity: 3 },
          { variantId: "a", quantity: 3 },
        ],
        variants: [variant("a", 10, 4, 5)],
        discount: 0,
      }),
    ).toThrow(/Estoque insuficiente para o SKU SKU-a/);
  });

  it("rejeita desconto maior que o subtotal", () => {
    expect(() =>
      computeSaleTotals({
        items: [{ variantId: "a", quantity: 1 }],
        variants: [variant("a", 100, 60, 10)],
        discount: 100.01,
      }),
    ).toThrow(/desconto/i);
  });

  it("aceita desconto igual ao subtotal", () => {
    const result = computeSaleTotals({
      items: [{ variantId: "a", quantity: 1 }],
      variants: [variant("a", 100, 60, 10)],
      discount: 100,
    });
    expect(result.totalAmount).toBe(0);
    expect(result.totalProfit).toBe(-60);
  });

  it("rejeita desconto negativo", () => {
    expect(() =>
      computeSaleTotals({
        items: [{ variantId: "a", quantity: 1 }],
        variants: [variant("a", 100, 60, 10)],
        discount: -1,
      }),
    ).toThrow(DomainError);
  });

  it("rejeita SKU inexistente na academia", () => {
    expect(() =>
      computeSaleTotals({
        items: [{ variantId: "fantasma", quantity: 1 }],
        variants: [variant("a", 100, 60, 10)],
        discount: 0,
      }),
    ).toThrow(/não .*encontrado/i);
  });

  it("arredonda valores em centavos", () => {
    const result = computeSaleTotals({
      items: [{ variantId: "a", quantity: 3 }],
      variants: [variant("a", 19.99, 9.33, 10)],
      discount: 0,
    });
    expect(result.subtotal).toBe(59.97);
    expect(result.totalProfit).toBe(31.98);
  });
});

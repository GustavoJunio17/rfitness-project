import { describe, expect, it } from "vitest";
import { computeOrderTotals, assertDeliveryAddress } from "./order-totals";
import { DomainError } from "../shared/errors";

const variant = (id: string, salePrice: number, currentQuantity: number) => ({
  id,
  sku: `SKU-${id}`,
  salePrice,
  currentQuantity,
});

describe("computeOrderTotals", () => {
  it("soma o total e funde itens duplicados", () => {
    const result = computeOrderTotals({
      items: [
        { variantId: "a", quantity: 1 },
        { variantId: "a", quantity: 2 },
        { variantId: "b", quantity: 1 },
      ],
      variants: [variant("a", 25.5, 10), variant("b", 10, 10)],
    });

    expect(result.totalAmount).toBe(86.5);
    expect(result.lines).toEqual([
      { variantId: "a", quantity: 3, unitPrice: 25.5 },
      { variantId: "b", quantity: 1, unitPrice: 10 },
    ]);
  });

  it("rejeita estoque insuficiente na criação do pedido", () => {
    expect(() =>
      computeOrderTotals({
        items: [{ variantId: "a", quantity: 11 }],
        variants: [variant("a", 10, 10)],
      }),
    ).toThrow(/Estoque insuficiente para o SKU SKU-a/);
  });

  it("rejeita SKU desconhecido", () => {
    expect(() =>
      computeOrderTotals({
        items: [{ variantId: "x", quantity: 1 }],
        variants: [variant("a", 10, 10)],
      }),
    ).toThrow(DomainError);
  });
});

describe("assertDeliveryAddress", () => {
  it("exige endereço para entrega", () => {
    expect(() => assertDeliveryAddress("DELIVERY", undefined)).toThrow(/endereço/i);
    expect(() => assertDeliveryAddress("DELIVERY", "   ")).toThrow(/endereço/i);
  });

  it("aceita entrega com endereço e retirada sem endereço", () => {
    expect(() => assertDeliveryAddress("DELIVERY", "Rua A, 100")).not.toThrow();
    expect(() => assertDeliveryAddress("PICKUP", undefined)).not.toThrow();
  });
});

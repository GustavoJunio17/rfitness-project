import { describe, expect, it } from "vitest";
import { sanitizeSignalPayload, REALTIME_EVENT_TYPES } from "./signal";

describe("sanitizeSignalPayload", () => {
  it("mantém ids e escalares simples", () => {
    expect(sanitizeSignalPayload({ saleId: "s-1", quantity: 3, resolved: true })).toEqual({
      saleId: "s-1",
      quantity: 3,
      resolved: true,
    });
  });

  it("remove campos monetários — o canal transporta sinal, não valor", () => {
    expect(
      sanitizeSignalPayload({
        orderId: "o-1",
        totalAmount: 199.9,
        totalProfit: 80,
        revenue: 1000,
        costPrice: 10,
        salePrice: 20,
        discount: 5,
        amount: 42,
      }),
    ).toEqual({ orderId: "o-1" });
  });

  it("remove objetos e arrays aninhados", () => {
    expect(sanitizeSignalPayload({ orderId: "o-1", items: [{ sku: "X" }], student: { name: "Ana" } })).toEqual({
      orderId: "o-1",
    });
  });

  it("remove valores nulos e indefinidos", () => {
    expect(sanitizeSignalPayload({ orderId: "o-1", studentId: null, extra: undefined })).toEqual({
      orderId: "o-1",
    });
  });

  it("aceita payload vazio", () => {
    expect(sanitizeSignalPayload({})).toEqual({});
    expect(sanitizeSignalPayload(undefined)).toEqual({});
  });

  it("trunca string longa para não usar o canal como transporte de dados", () => {
    const long = "x".repeat(200);
    const result = sanitizeSignalPayload({ label: long });
    expect((result.label as string).length).toBe(120);
  });
});

describe("REALTIME_EVENT_TYPES", () => {
  it("cobre todos os eventos consumidos pelo dashboard", () => {
    expect([...REALTIME_EVENT_TYPES]).toEqual([
      "sale.created",
      "stock.movement.created",
      "stock.alert.created",
      "stock.alert.resolved",
      "student.created",
      "order.created",
      "order.status_changed",
      "whatsapp.message.received",
      "notification.created",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { assertOrderTransition, canTransitionOrder, nextOrderStatuses, isTerminalOrderStatus } from "./order-status";
import { DomainError } from "../shared/errors";

describe("canTransitionOrder", () => {
  it("aceita o caminho feliz completo", () => {
    expect(canTransitionOrder("PENDING", "SEPARATING")).toBe(true);
    expect(canTransitionOrder("SEPARATING", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransitionOrder("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
  });

  it("aceita cancelamento de qualquer estado não terminal", () => {
    expect(canTransitionOrder("PENDING", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("SEPARATING", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("OUT_FOR_DELIVERY", "CANCELLED")).toBe(true);
  });

  it("recusa saltos de etapa", () => {
    expect(canTransitionOrder("PENDING", "DELIVERED")).toBe(false);
    expect(canTransitionOrder("PENDING", "OUT_FOR_DELIVERY")).toBe(false);
  });

  it("recusa retrocesso", () => {
    expect(canTransitionOrder("DELIVERED", "SEPARATING")).toBe(false);
    expect(canTransitionOrder("OUT_FOR_DELIVERY", "PENDING")).toBe(false);
  });

  it("recusa saída de estados terminais", () => {
    expect(canTransitionOrder("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "PENDING")).toBe(false);
  });

  it("recusa transição para o mesmo estado", () => {
    expect(canTransitionOrder("PENDING", "PENDING")).toBe(false);
  });
});

describe("assertOrderTransition", () => {
  it("não lança em transição válida", () => {
    expect(() => assertOrderTransition("PENDING", "SEPARATING")).not.toThrow();
  });

  it("lança DomainError citando os dois estados", () => {
    expect(() => assertOrderTransition("PENDING", "DELIVERED")).toThrow(DomainError);
    expect(() => assertOrderTransition("PENDING", "DELIVERED")).toThrow(/PENDING.*DELIVERED/);
  });
});

describe("nextOrderStatuses / isTerminalOrderStatus", () => {
  it("lista as próximas transições possíveis", () => {
    expect(nextOrderStatuses("PENDING")).toEqual(["SEPARATING", "CANCELLED"]);
    expect(nextOrderStatuses("DELIVERED")).toEqual([]);
  });

  it("identifica estados terminais", () => {
    expect(isTerminalOrderStatus("DELIVERED")).toBe(true);
    expect(isTerminalOrderStatus("CANCELLED")).toBe(true);
    expect(isTerminalOrderStatus("PENDING")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { decideLowStockAlert, decideExpiryAlerts, decideStaleAlert } from "./alerts";

describe("decideLowStockAlert", () => {
  it("abre alerta quando cruza o mínimo e não há alerta aberto", () => {
    expect(decideLowStockAlert({ minQuantity: 5, currentQuantity: 5, hasOpenAlert: false })).toBe("OPEN");
    expect(decideLowStockAlert({ minQuantity: 5, currentQuantity: 2, hasOpenAlert: false })).toBe("OPEN");
  });

  it("não duplica alerta já aberto", () => {
    expect(decideLowStockAlert({ minQuantity: 5, currentQuantity: 2, hasOpenAlert: true })).toBe("NOOP");
  });

  it("resolve quando volta acima do mínimo", () => {
    expect(decideLowStockAlert({ minQuantity: 5, currentQuantity: 6, hasOpenAlert: true })).toBe("RESOLVE");
  });

  it("nada a fazer quando está acima do mínimo e sem alerta", () => {
    expect(decideLowStockAlert({ minQuantity: 5, currentQuantity: 6, hasOpenAlert: false })).toBe("NOOP");
  });

  it("minQuantity zero só alerta quando o estoque zera", () => {
    expect(decideLowStockAlert({ minQuantity: 0, currentQuantity: 1, hasOpenAlert: false })).toBe("NOOP");
    expect(decideLowStockAlert({ minQuantity: 0, currentQuantity: 0, hasOpenAlert: false })).toBe("OPEN");
  });
});

describe("decideExpiryAlerts", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("marca EXPIRED quando a validade passou", () => {
    const result = decideExpiryAlerts({
      expiresAt: new Date("2026-07-28T00:00:00.000Z"),
      now,
      expiringSoonDays: 7,
      hasOpenExpired: false,
      hasOpenExpiringSoon: false,
    });
    expect(result.expired).toBe("OPEN");
    expect(result.expiringSoon).toBe("NOOP");
  });

  it("resolve EXPIRING_SOON quando o item já venceu de fato", () => {
    const result = decideExpiryAlerts({
      expiresAt: new Date("2026-07-28T00:00:00.000Z"),
      now,
      expiringSoonDays: 7,
      hasOpenExpired: false,
      hasOpenExpiringSoon: true,
    });
    expect(result.expired).toBe("OPEN");
    expect(result.expiringSoon).toBe("RESOLVE");
  });

  it("marca EXPIRING_SOON dentro da janela", () => {
    const result = decideExpiryAlerts({
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
      now,
      expiringSoonDays: 7,
      hasOpenExpired: false,
      hasOpenExpiringSoon: false,
    });
    expect(result.expiringSoon).toBe("OPEN");
    expect(result.expired).toBe("NOOP");
  });

  it("ignora item fora da janela", () => {
    const result = decideExpiryAlerts({
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      now,
      expiringSoonDays: 7,
      hasOpenExpired: false,
      hasOpenExpiringSoon: false,
    });
    expect(result).toEqual({ expired: "NOOP", expiringSoon: "NOOP" });
  });

  it("resolve os dois alertas quando o SKU deixa de ter validade", () => {
    const result = decideExpiryAlerts({
      expiresAt: null,
      now,
      expiringSoonDays: 7,
      hasOpenExpired: true,
      hasOpenExpiringSoon: true,
    });
    expect(result).toEqual({ expired: "RESOLVE", expiringSoon: "RESOLVE" });
  });
});

describe("decideStaleAlert", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("abre alerta quando não há movimentação na janela", () => {
    expect(
      decideStaleAlert({
        lastMovementAt: new Date("2026-01-01T00:00:00.000Z"),
        now,
        staleAfterDays: 60,
        hasOpenAlert: false,
      }),
    ).toBe("OPEN");
  });

  it("considera a data de criação quando nunca houve movimentação", () => {
    expect(
      decideStaleAlert({
        lastMovementAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        now,
        staleAfterDays: 60,
        hasOpenAlert: false,
      }),
    ).toBe("OPEN");
  });

  it("não alerta SKU recém-criado sem movimentação", () => {
    expect(
      decideStaleAlert({
        lastMovementAt: null,
        createdAt: new Date("2026-07-25T00:00:00.000Z"),
        now,
        staleAfterDays: 60,
        hasOpenAlert: false,
      }),
    ).toBe("NOOP");
  });

  it("resolve quando volta a movimentar", () => {
    expect(
      decideStaleAlert({
        lastMovementAt: new Date("2026-07-28T00:00:00.000Z"),
        now,
        staleAfterDays: 60,
        hasOpenAlert: true,
      }),
    ).toBe("RESOLVE");
  });
});

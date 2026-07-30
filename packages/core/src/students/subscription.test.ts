import { describe, expect, it } from "vitest";
import { computeDueDate, deriveStudentStatus, isSubscriptionOverdue } from "./subscription";
import { DomainError } from "../shared/errors";

describe("computeDueDate", () => {
  it("soma a duração do plano à data de início", () => {
    expect(computeDueDate(new Date("2026-07-29T00:00:00.000Z"), 30).toISOString()).toBe(
      "2026-08-28T00:00:00.000Z",
    );
  });

  it("preserva a hora do início", () => {
    expect(computeDueDate(new Date("2026-07-29T13:45:00.000Z"), 1).toISOString()).toBe(
      "2026-07-30T13:45:00.000Z",
    );
  });

  it("rejeita duração não positiva", () => {
    expect(() => computeDueDate(new Date(), 0)).toThrow(DomainError);
    expect(() => computeDueDate(new Date(), -5)).toThrow(/duração/i);
  });
});

describe("isSubscriptionOverdue", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("vencida quando dueDate passou", () => {
    expect(isSubscriptionOverdue({ dueDate: new Date("2026-07-28T00:00:00.000Z"), cancelledAt: null }, now)).toBe(
      true,
    );
  });

  it("em dia quando dueDate é futuro", () => {
    expect(isSubscriptionOverdue({ dueDate: new Date("2026-08-28T00:00:00.000Z"), cancelledAt: null }, now)).toBe(
      false,
    );
  });

  it("matrícula cancelada não conta como vencida", () => {
    expect(
      isSubscriptionOverdue(
        { dueDate: new Date("2026-01-01T00:00:00.000Z"), cancelledAt: new Date("2026-02-01T00:00:00.000Z") },
        now,
      ),
    ).toBe(false);
  });
});

describe("deriveStudentStatus", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("mantém status manual de SUSPENDED e CANCELLED", () => {
    expect(deriveStudentStatus("SUSPENDED", [], now)).toBe("SUSPENDED");
    expect(deriveStudentStatus("CANCELLED", [], now)).toBe("CANCELLED");
  });

  it("marca OVERDUE quando todas as matrículas estão vencidas", () => {
    expect(
      deriveStudentStatus("ACTIVE", [{ dueDate: new Date("2026-07-01T00:00:00.000Z"), cancelledAt: null }], now),
    ).toBe("OVERDUE");
  });

  it("volta para ACTIVE quando existe matrícula em dia", () => {
    expect(
      deriveStudentStatus(
        "OVERDUE",
        [
          { dueDate: new Date("2026-07-01T00:00:00.000Z"), cancelledAt: null },
          { dueDate: new Date("2026-08-30T00:00:00.000Z"), cancelledAt: null },
        ],
        now,
      ),
    ).toBe("ACTIVE");
  });

  it("aluno sem matrícula permanece ACTIVE", () => {
    expect(deriveStudentStatus("ACTIVE", [], now)).toBe("ACTIVE");
  });
});

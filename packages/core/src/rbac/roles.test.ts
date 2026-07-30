import { describe, expect, it } from "vitest";
import { hasAnyRole, assertRole, ROLES } from "./roles";
import { DomainError } from "../shared/errors";

describe("hasAnyRole", () => {
  it("aceita quando o usuário tem um dos papéis exigidos", () => {
    expect(hasAnyRole(["RECEPTION"], ["ADMIN", "RECEPTION"])).toBe(true);
  });

  it("recusa quando não tem nenhum", () => {
    expect(hasAnyRole(["STOCKIST"], ["ADMIN", "FINANCE"])).toBe(false);
  });

  it("lista de exigidos vazia libera qualquer autenticado", () => {
    expect(hasAnyRole(["TRAINER"], [])).toBe(true);
  });

  it("usuário sem papel nenhum é recusado quando há exigência", () => {
    expect(hasAnyRole([], ["ADMIN"])).toBe(false);
  });
});

describe("assertRole", () => {
  it("lança FORBIDDEN quando falta o papel", () => {
    const error = (() => {
      try {
        assertRole(["STOCKIST"], ["ADMIN", "FINANCE"]);
        return null;
      } catch (caught) {
        return caught as DomainError;
      }
    })();

    expect(error).toBeInstanceOf(DomainError);
    expect(error?.code).toBe("FORBIDDEN");
    expect(error?.httpStatus).toBe(403);
  });

  it("não lança com papel suficiente", () => {
    expect(() => assertRole(["ADMIN"], ["ADMIN"])).not.toThrow();
  });
});

describe("ROLES", () => {
  it("expõe exatamente os papéis do sistema", () => {
    expect([...ROLES]).toEqual(["ADMIN", "RECEPTION", "STOCKIST", "FINANCE", "TRAINER"]);
  });
});

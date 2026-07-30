import { describe, expect, it } from "vitest";
import { DomainError, isDomainError } from "./errors";

describe("DomainError", () => {
  it("carrega código e status HTTP correspondente", () => {
    expect(new DomainError("VALIDATION", "x").httpStatus).toBe(400);
    expect(new DomainError("NOT_FOUND", "x").httpStatus).toBe(404);
    expect(new DomainError("CONFLICT", "x").httpStatus).toBe(409);
    expect(new DomainError("FORBIDDEN", "x").httpStatus).toBe(403);
    expect(new DomainError("UNAUTHORIZED", "x").httpStatus).toBe(401);
  });

  it("preserva a mensagem e o nome", () => {
    const error = new DomainError("VALIDATION", "Desconto inválido");
    expect(error.message).toBe("Desconto inválido");
    expect(error.name).toBe("DomainError");
    expect(error).toBeInstanceOf(Error);
  });

  it("isDomainError distingue de erros comuns", () => {
    expect(isDomainError(new DomainError("VALIDATION", "x"))).toBe(true);
    expect(isDomainError(new Error("x"))).toBe(false);
    expect(isDomainError(null)).toBe(false);
  });
});

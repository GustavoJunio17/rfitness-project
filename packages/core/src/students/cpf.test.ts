import { describe, expect, it } from "vitest";
import { isValidCpf } from "./cpf";

describe("isValidCpf", () => {
  it("aceita CPF com dígitos verificadores corretos, mascarado ou cru", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("recusa um dígito trocado — o erro de digitação que se quer pegar", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("529.982.247-15")).toBe(false);
    // Dois dígitos do meio invertidos.
    expect(isValidCpf("529.928.247-25")).toBe(false);
  });

  it("recusa repetidos, que passam na conta mas não existem", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidCpf("999.999.999-99")).toBe(false);
  });

  it("recusa incompleto — é o estado normal enquanto se digita", () => {
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("529.982.247")).toBe(false);
    expect(isValidCpf("529982247251")).toBe(false);
  });

  it("cobre o caso de dígito verificador 0 (resto 10 vira 0)", () => {
    expect(isValidCpf("100.000.001-08")).toBe(true);
    expect(isValidCpf("100.000.015-03")).toBe(true);
  });
});

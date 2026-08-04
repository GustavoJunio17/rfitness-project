import { describe, expect, it } from "vitest";
import { formatCpf, formatPhone, maskCpf, maskPhone, onlyDigits } from "./masks";

describe("maskCpf", () => {
  it("monta o formato conforme os dígitos chegam", () => {
    expect(maskCpf("1")).toBe("1");
    expect(maskCpf("123")).toBe("123");
    expect(maskCpf("1234")).toBe("123.4");
    expect(maskCpf("1234567")).toBe("123.456.7");
    expect(maskCpf("12345678901")).toBe("123.456.789-01");
  });

  it("ignora o que passa de 11 dígitos", () => {
    expect(maskCpf("123456789012345")).toBe("123.456.789-01");
  });

  it("reaplica sobre valor já mascarado — é o que acontece a cada tecla", () => {
    expect(maskCpf("123.456.789-01")).toBe("123.456.789-01");
  });

  it("apagar um dígito não deixa separador órfão no fim", () => {
    expect(maskCpf("123.")).toBe("123");
    expect(maskCpf("123.456.789-")).toBe("123.456.789");
  });
});

describe("maskPhone", () => {
  it("trata 8 dígitos como fixo e 9 como celular", () => {
    expect(maskPhone("3133334444")).toBe("(31) 3333-4444");
    expect(maskPhone("31999991111")).toBe("(31) 99999-1111");
  });

  it("monta o formato conforme os dígitos chegam", () => {
    expect(maskPhone("3")).toBe("(3");
    expect(maskPhone("31")).toBe("(31");
    expect(maskPhone("319")).toBe("(31) 9");
    expect(maskPhone("3199999")).toBe("(31) 9999-9");
  });

  it("passando de 11 dígitos, os dois primeiros viram código do país", () => {
    expect(maskPhone("5531999991111")).toBe("+55 (31) 99999-1111");
  });

  it("ignora o que passa de 13 dígitos", () => {
    expect(maskPhone("55319999911119999")).toBe("+55 (31) 99999-1111");
  });

  it("reaplica sobre valor já mascarado", () => {
    expect(maskPhone("(31) 99999-1111")).toBe("(31) 99999-1111");
    expect(maskPhone("+55 (31) 99999-1111")).toBe("+55 (31) 99999-1111");
  });

  it("campo vazio continua vazio", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("abc")).toBe("");
  });
});

describe("onlyDigits", () => {
  it("é o que vai para a API", () => {
    expect(onlyDigits("123.456.789-01")).toBe("12345678901");
    expect(onlyDigits("+55 (31) 99999-1111")).toBe("5531999991111");
  });
});

describe("formatadores de leitura", () => {
  it("devolvem null para ausente ou vazio, e não '—' nem string vazia", () => {
    expect(formatCpf(null)).toBeNull();
    expect(formatCpf("")).toBeNull();
    expect(formatPhone(undefined)).toBeNull();
    expect(formatPhone("abc")).toBeNull();
  });

  it("formatam o dígito cru vindo do banco", () => {
    expect(formatCpf("12345678901")).toBe("123.456.789-01");
    expect(formatPhone("5531999991111")).toBe("+55 (31) 99999-1111");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatCpf,
  formatPhone,
  maskCpf,
  maskMoney,
  maskPhone,
  moneyToMask,
  onlyDigits,
  parseMoney,
} from "./masks";

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

describe("maskMoney", () => {
  it("preenche os centavos da direita para a esquerda", () => {
    expect(maskMoney("1")).toBe("0,01");
    expect(maskMoney("12")).toBe("0,12");
    expect(maskMoney("123")).toBe("1,23");
    expect(maskMoney("123250")).toBe("1.232,50");
  });

  it("separa milhar a cada três casas", () => {
    expect(maskMoney("100000")).toBe("1.000,00");
    expect(maskMoney("123456789")).toBe("1.234.567,89");
  });

  it("ignora o que não é dígito — era o furo do input numérico", () => {
    expect(maskMoney("1232p")).toBe("12,32");
    expect(maskMoney("abc")).toBe("");
    expect(maskMoney("")).toBe("");
  });

  it("reaplica sobre valor já mascarado, que é o caso a cada tecla", () => {
    expect(maskMoney("1.232,50")).toBe("1.232,50");
  });

  it("apagar dígitos anda o valor de volta até esvaziar", () => {
    expect(maskMoney("1.232,5")).toBe("123,25");
    expect(maskMoney("0,0")).toBe("");
    expect(maskMoney("0")).toBe("");
  });

  it("negativo só quando o campo permite", () => {
    expect(maskMoney("-5000", { allowNegative: true })).toBe("-50,00");
    expect(maskMoney("-5000")).toBe("50,00");
    // Sinal sozinho: a pessoa ainda vai digitar o número.
    expect(maskMoney("-", { allowNegative: true })).toBe("-");
  });

  it("não passa do inteiro seguro do JS", () => {
    expect(parseMoney(maskMoney("9".repeat(20)))).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

describe("parseMoney", () => {
  it("devolve o número que vai para a API", () => {
    expect(parseMoney("1.232,50")).toBe(1232.5);
    expect(parseMoney("0,01")).toBe(0.01);
    expect(parseMoney("-50,00")).toBe(-50);
  });

  it("campo vazio é null, e não zero — zero é um valor que alguém pode querer", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("-")).toBeNull();
    expect(parseMoney("0,00")).toBe(0);
  });
});

describe("moneyToMask", () => {
  it("traz o valor gravado de volta para o campo", () => {
    expect(moneyToMask(1232.5)).toBe("1.232,50");
    expect(moneyToMask(0)).toBe("0,00");
    expect(moneyToMask(-50)).toBe("-50,00");
  });

  it("arredonda o centavo em vez de truncar", () => {
    // 19.99 não é exato em ponto flutuante; truncar daria 19,98.
    expect(moneyToMask(19.99)).toBe("19,99");
    expect(moneyToMask(0.615)).toBe("0,62");
  });

  it("ausente vira campo vazio", () => {
    expect(moneyToMask(null)).toBe("");
    expect(moneyToMask(undefined)).toBe("");
    expect(moneyToMask(Number.NaN)).toBe("");
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

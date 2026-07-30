import { describe, expect, it } from "vitest";
import { buildSku, slugifyToken } from "./sku";

describe("slugifyToken", () => {
  it("normaliza acentos, espaços e caixa", () => {
    expect(slugifyToken("Whey Protein Concentrado")).toBe("WHEYPROTEINCONCENTRADO");
    expect(slugifyToken("Baunilha Cremosa")).toBe("BAUNILHACREMOSA");
    expect(slugifyToken("Açaí")).toBe("ACAI");
    expect(slugifyToken("1,5kg")).toBe("15KG");
  });

  it("devolve string vazia para entrada vazia ou nula", () => {
    expect(slugifyToken("")).toBe("");
    expect(slugifyToken(null)).toBe("");
    expect(slugifyToken(undefined)).toBe("");
  });
});

describe("buildSku", () => {
  it("compõe produto, marca, sabor e peso", () => {
    expect(
      buildSku({ productName: "Whey Protein", brandName: "Growth", flavor: "Baunilha", weight: "900g" }),
    ).toBe("WHE-GRO-BAU-900G");
  });

  it("omite segmentos ausentes", () => {
    expect(buildSku({ productName: "Camiseta Dry Fit" })).toBe("CAM");
    expect(buildSku({ productName: "Creatina", brandName: "Max Titanium" })).toBe("CRE-MAX");
  });

  it("aplica sufixo de desambiguação quando informado", () => {
    expect(buildSku({ productName: "Creatina", brandName: "Max", suffix: 2 })).toBe("CRE-MAX-2");
  });

  it("rejeita nome de produto vazio", () => {
    expect(() => buildSku({ productName: "   " })).toThrow(/produto/i);
  });

  it("é estável para a mesma entrada", () => {
    const input = { productName: "BCAA", brandName: "Integral", flavor: "Limão", weight: "300g" };
    expect(buildSku(input)).toBe(buildSku(input));
  });
});

import { describe, expect, it } from "vitest";
import { GYM_SLUG_PATTERN, buildGymSlugBase, resolveGymSlug, slugifyGymName } from "./gym-slug";

describe("slugifyGymName", () => {
  it("normaliza acentos, espaços e símbolos", () => {
    expect(slugifyGymName("Bora Bill")).toBe("bora-bill");
    expect(slugifyGymName("Academia Força & Ação!")).toBe("academia-forca-acao");
    expect(slugifyGymName("  --Fit--  ")).toBe("fit");
  });

  it("devolve vazio quando não sobra nada utilizável", () => {
    expect(slugifyGymName("北京")).toBe("");
    expect(slugifyGymName("!!!")).toBe("");
  });
});

describe("buildGymSlugBase", () => {
  it("usa fallback quando o nome não gera slug válido", () => {
    expect(buildGymSlugBase("北京")).toBe("academia");
    expect(buildGymSlugBase("Ac")).toBe("academia");
  });

  it("sempre produz slug que passa no padrão do banco", () => {
    for (const name of ["Bora Bill", "北京", "A".repeat(80), "Fit 24h"]) {
      expect(buildGymSlugBase(name)).toMatch(GYM_SLUG_PATTERN);
    }
  });
});

describe("resolveGymSlug", () => {
  it("usa o slug base quando está livre", () => {
    expect(resolveGymSlug("Bora Bill", [])).toBe("bora-bill");
  });

  it("incrementa sufixo em colisão", () => {
    expect(resolveGymSlug("Bora Bill", ["bora-bill"])).toBe("bora-bill-2");
    expect(resolveGymSlug("Bora Bill", ["bora-bill", "bora-bill-2"])).toBe("bora-bill-3");
  });

  it("respeita o limite de 40 caracteres ao adicionar sufixo", () => {
    const longName = "Academia Muito Grande Do Bairro Central Zona Sul";
    const base = resolveGymSlug(longName, []);
    const withSuffix = resolveGymSlug(longName, [base]);
    expect(base.length).toBeLessThanOrEqual(40);
    expect(withSuffix.length).toBeLessThanOrEqual(40);
    expect(withSuffix).toMatch(GYM_SLUG_PATTERN);
    expect(withSuffix).not.toBe(base);
  });
});

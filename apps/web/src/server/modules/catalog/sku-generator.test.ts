import { describe, expect, it, vi } from "vitest";
import { generateUniqueSku } from "./sku-generator";

describe("generateUniqueSku", () => {
  it("usa o SKU base quando está livre", async () => {
    const exists = vi.fn().mockResolvedValue(false);

    const sku = await generateUniqueSku(
      { productName: "Whey Protein", brandName: "Growth", flavor: "Baunilha", weight: "900g" },
      exists,
    );

    expect(sku).toBe("WHE-GRO-BAU-900G");
    expect(exists).toHaveBeenCalledWith("WHE-GRO-BAU-900G");
  });

  it("acrescenta sufixo até achar um SKU livre", async () => {
    const taken = new Set(["CRE-MAX", "CRE-MAX-2", "CRE-MAX-3"]);
    const exists = vi.fn().mockImplementation(async (sku: string) => taken.has(sku));

    const sku = await generateUniqueSku({ productName: "Creatina", brandName: "Max" }, exists);

    expect(sku).toBe("CRE-MAX-4");
  });

  it("respeita o SKU informado manualmente quando está livre", async () => {
    const exists = vi.fn().mockResolvedValue(false);

    const sku = await generateUniqueSku(
      { productName: "Creatina", desiredSku: "MINHA-SKU-01" },
      exists,
    );

    expect(sku).toBe("MINHA-SKU-01");
  });

  it("recusa SKU informado manualmente que já existe — não inventa sufixo pelo usuário", async () => {
    const exists = vi.fn().mockResolvedValue(true);

    await expect(
      generateUniqueSku({ productName: "Creatina", desiredSku: "MINHA-SKU-01" }, exists),
    ).rejects.toThrow(/já existe/i);
  });

  it("desiste depois de um número razoável de tentativas em vez de girar para sempre", async () => {
    const exists = vi.fn().mockResolvedValue(true);

    await expect(generateUniqueSku({ productName: "Creatina" }, exists)).rejects.toThrow(/SKU único/i);
    expect(exists.mock.calls.length).toBeLessThanOrEqual(50);
  });
});

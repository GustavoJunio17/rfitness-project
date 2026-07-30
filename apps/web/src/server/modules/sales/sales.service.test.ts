import { describe, expect, it, vi } from "vitest";
import { createSalesService } from "./sales.service";
import type { SalesRepository, SalesSideEffects } from "./sales.ports";

const variants = [
  { id: "a", sku: "SKU-A", salePrice: 100, costPrice: 60, currentQuantity: 10, minQuantity: 2 },
  { id: "b", sku: "SKU-B", salePrice: 50, costPrice: 20, currentQuantity: 1, minQuantity: 1 },
];

function makeRepo(overrides: Partial<SalesRepository> = {}): SalesRepository {
  return {
    findSellableVariants: vi.fn().mockResolvedValue(variants),
    create: vi.fn().mockResolvedValue({
      id: "sale-1",
      totalAmount: 0,
      totalProfit: 0,
      discount: 0,
      paymentMethod: "PIX",
      studentName: null,
      employeeName: "Admin",
      createdAt: new Date(),
      items: [],
    }),
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeSideEffects(overrides: Partial<SalesSideEffects> = {}): SalesSideEffects {
  return {
    evaluateLowStock: vi.fn().mockResolvedValue(undefined),
    registerSaleRevenue: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createSale", () => {
  it("persiste a venda com totais e linhas calculados pelo core", async () => {
    const repo = makeRepo();
    const service = createSalesService(repo, makeSideEffects());

    await service.createSale("gym-1", "user-1", {
      items: [{ variantId: "a", quantity: 2 }],
      paymentMethod: "PIX",
      discount: 10,
    });

    expect(repo.create).toHaveBeenCalledWith({
      gymId: "gym-1",
      employeeId: "user-1",
      studentId: null,
      paymentMethod: "PIX",
      discount: 10,
      totalAmount: 190,
      totalProfit: 70,
      lines: [{ variantId: "a", quantity: 2, unitPrice: 100, unitCost: 60, resultingQuantity: 8 }],
    });
  });

  it("recusa venda com estoque insuficiente sem tocar no banco", async () => {
    const repo = makeRepo();
    const service = createSalesService(repo, makeSideEffects());

    await expect(
      service.createSale("gym-1", "user-1", {
        items: [{ variantId: "b", quantity: 2 }],
        paymentMethod: "CASH",
      }),
    ).rejects.toThrow(/Estoque insuficiente para o SKU SKU-B/);

    expect(repo.create).not.toHaveBeenCalled();
  });

  it("recusa desconto maior que o subtotal", async () => {
    const service = createSalesService(makeRepo(), makeSideEffects());

    await expect(
      service.createSale("gym-1", "user-1", {
        items: [{ variantId: "b", quantity: 1 }],
        paymentMethod: "CASH",
        discount: 51,
      }),
    ).rejects.toThrow(/desconto/i);
  });

  it("mantém o aluno quando informado", async () => {
    const repo = makeRepo();
    const service = createSalesService(repo, makeSideEffects());

    await service.createSale("gym-1", "user-1", {
      items: [{ variantId: "a", quantity: 1 }],
      paymentMethod: "CREDIT_CARD",
      studentId: "student-9",
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ studentId: "student-9" }));
  });

  it("dispara os efeitos pós-venda: alerta, fluxo de caixa e sinal", async () => {
    const repo = makeRepo({
      create: vi.fn().mockResolvedValue({
        id: "sale-42",
        totalAmount: 200,
        totalProfit: 80,
        discount: 0,
        paymentMethod: "PIX",
        studentName: null,
        employeeName: "Admin",
        createdAt: new Date("2026-07-29T12:00:00.000Z"),
        items: [],
      }),
    });
    const sideEffects = makeSideEffects();
    const service = createSalesService(repo, sideEffects);

    await service.createSale("gym-1", "user-1", {
      items: [{ variantId: "a", quantity: 2 }],
      paymentMethod: "PIX",
    });

    expect(sideEffects.evaluateLowStock).toHaveBeenCalledWith({
      id: "a",
      gymId: "gym-1",
      sku: "SKU-A",
      minQuantity: 2,
      currentQuantity: 8,
    });
    expect(sideEffects.registerSaleRevenue).toHaveBeenCalledWith("gym-1", "sale-42", 200);
    expect(sideEffects.publish).toHaveBeenCalledWith("gym-1", "sale.created", { saleId: "sale-42" });
  });

  it("falha em efeito colateral não invalida a venda já gravada", async () => {
    const sideEffects = makeSideEffects({
      registerSaleRevenue: vi.fn().mockRejectedValue(new Error("fluxo de caixa fora do ar")),
    });
    const service = createSalesService(makeRepo(), sideEffects);

    await expect(
      service.createSale("gym-1", "user-1", {
        items: [{ variantId: "a", quantity: 1 }],
        paymentMethod: "PIX",
      }),
    ).resolves.toMatchObject({ id: "sale-1" });
  });

  it("recusa SKU que não é da academia", async () => {
    const repo = makeRepo({ findSellableVariants: vi.fn().mockResolvedValue([]) });
    const service = createSalesService(repo, makeSideEffects());

    await expect(
      service.createSale("gym-1", "user-1", {
        items: [{ variantId: "a", quantity: 1 }],
        paymentMethod: "PIX",
      }),
    ).rejects.toThrow(/não foram encontrados/i);
  });

  it("consulta o repositório só com os ids distintos do carrinho", async () => {
    const repo = makeRepo();
    const service = createSalesService(repo, makeSideEffects());

    await service.createSale("gym-1", "user-1", {
      items: [
        { variantId: "a", quantity: 1 },
        { variantId: "a", quantity: 2 },
      ],
      paymentMethod: "PIX",
    });

    expect(repo.findSellableVariants).toHaveBeenCalledWith("gym-1", ["a"]);
  });
});

describe("getSale", () => {
  it("404 quando a venda não é da academia", async () => {
    const service = createSalesService(makeRepo(), makeSideEffects());
    await expect(service.getSale("gym-1", "sale-x")).rejects.toThrow(/não encontrada/i);
  });
});

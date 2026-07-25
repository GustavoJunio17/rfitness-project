import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/shared/prisma/prisma.service";

describe("Finance flow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const gymSlug = `e2e-finance-${process.hrtime.bigint()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const registerResponse = await request(app.getHttpServer())
      .post("/api/auth/register-gym")
      .send({
        gymName: "Academia Financeiro E2E",
        gymSlug,
        adminName: "Admin Financeiro",
        adminEmail: "admin@financeiro-e2e.com",
        adminPassword: "SenhaForte@123",
      });
    accessToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { slug: gymSlug } });
    await app.close();
  });

  it("reflects a sale in the finance summary and creates an automatic cash-flow entry", async () => {
    const server = app.getHttpServer();
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    const productResponse = await request(server)
      .post("/api/catalog/products")
      .set(auth())
      .send({
        name: "Barra de Proteína",
        variants: [{ costPrice: 5, salePrice: 10, minQuantity: 2, initialQuantity: 50 }],
      })
      .expect(201);
    const variant = productResponse.body.variants[0];

    await request(server)
      .post("/api/sales")
      .set(auth())
      .send({ paymentMethod: "CASH", items: [{ variantId: variant.id, quantity: 3 }] })
      .expect(201);

    const summary = await request(server).get("/api/finance/summary").set(auth()).expect(200);
    expect(summary.body.revenue.today).toBeGreaterThanOrEqual(30);
    expect(summary.body.profit.today).toBeGreaterThanOrEqual(15);
    expect(summary.body.stock.stockValue).toBeGreaterThan(0);

    const cashFlow = await request(server).get("/api/finance/cash-flow").set(auth()).expect(200);
    const saleEntry = cashFlow.body.find((entry: { category: string }) => entry.category === "venda");
    expect(saleEntry).toBeDefined();
    expect(Number(saleEntry.amount)).toBe(30);

    await request(server)
      .post("/api/finance/cash-flow")
      .set(auth())
      .send({ description: "Aluguel", amount: -500, category: "aluguel" })
      .expect(201);

    const cashFlowAfterManualEntry = await request(server)
      .get("/api/finance/cash-flow")
      .set(auth())
      .expect(200);
    const rentEntry = cashFlowAfterManualEntry.body.find((entry: { category: string }) => entry.category === "aluguel");
    expect(rentEntry).toBeDefined();
    expect(Number(rentEntry.amount)).toBe(-500);
  });

  it("rejects unauthenticated access to the finance module", async () => {
    await request(app.getHttpServer()).get("/api/finance/summary").expect(401);
  });
});

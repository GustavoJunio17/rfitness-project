import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/shared/prisma/prisma.service";

describe("Sales flow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const gymSlug = `e2e-sales-${process.hrtime.bigint()}`;

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
        gymName: "Academia Vendas E2E",
        gymSlug,
        adminName: "Admin Vendas",
        adminEmail: "admin@vendas-e2e.com",
        adminPassword: "SenhaForte@123",
      });
    accessToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { slug: gymSlug } });
    await app.close();
  });

  it("sells a SKU, reduces stock, and records a SALE movement", async () => {
    const server = app.getHttpServer();
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    const productResponse = await request(server)
      .post("/api/catalog/products")
      .set(auth())
      .send({
        name: "Creatina",
        variants: [{ costPrice: 30, salePrice: 60, minQuantity: 5, initialQuantity: 10 }],
      })
      .expect(201);
    const variant = productResponse.body.variants[0];

    const saleResponse = await request(server)
      .post("/api/sales")
      .set(auth())
      .send({
        paymentMethod: "PIX",
        discount: 10,
        items: [{ variantId: variant.id, quantity: 4 }],
      })
      .expect(201);

    expect(saleResponse.body.totalAmount).toBe("230");
    expect(saleResponse.body.totalProfit).toBe("110");

    const productAfterSale = await request(server)
      .get(`/api/catalog/products/${productResponse.body.id}`)
      .set(auth())
      .expect(200);
    expect(productAfterSale.body.variants[0].currentQuantity).toBe(6);

    const movements = await request(server)
      .get(`/api/inventory/movements?variantId=${variant.id}`)
      .set(auth())
      .expect(200);
    const saleMovement = movements.body.find((m: { type: string }) => m.type === "SALE");
    expect(saleMovement).toBeDefined();
    expect(saleMovement.quantity).toBe(-4);

    const oversell = await request(server)
      .post("/api/sales")
      .set(auth())
      .send({ paymentMethod: "CASH", items: [{ variantId: variant.id, quantity: 999 }] })
      .expect(400);
    expect(oversell.body.message).toBeDefined();
  });
});

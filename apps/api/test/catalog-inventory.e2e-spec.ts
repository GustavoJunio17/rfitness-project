import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/shared/prisma/prisma.service";

describe("Catalog + Inventory flow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const gymSlug = `e2e-inv-${process.hrtime.bigint()}`;

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
        gymName: "Academia Estoque E2E",
        gymSlug,
        adminName: "Admin Estoque",
        adminEmail: "admin@estoque-e2e.com",
        adminPassword: "SenhaForte@123",
      });
    accessToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { slug: gymSlug } });
    await app.close();
  });

  it("registers a product with a SKU, moves stock, and raises a low-stock alert automatically", async () => {
    const server = app.getHttpServer();
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    const category = await request(server)
      .post("/api/catalog/categories")
      .set(auth())
      .send({ name: "Suplementos" })
      .expect(201);

    const brand = await request(server)
      .post("/api/catalog/brands")
      .set(auth())
      .send({ name: "Growth" })
      .expect(201);

    const productResponse = await request(server)
      .post("/api/catalog/products")
      .set(auth())
      .send({
        name: "Whey Protein",
        categoryId: category.body.id,
        variants: [
          {
            brandId: brand.body.id,
            flavor: "Chocolate",
            weight: "900g",
            barcode: `789${process.hrtime.bigint()}`,
            costPrice: 45.9,
            salePrice: 89.9,
            minQuantity: 5,
            initialQuantity: 10,
          },
        ],
      })
      .expect(201);

    const variant = productResponse.body.variants[0];
    expect(variant.sku).toBeDefined();
    expect(variant.currentQuantity).toBe(10);

    const qrCodeResponse = await request(server)
      .get(`/api/catalog/variants/${variant.id}/qrcode`)
      .set(auth())
      .expect(200);
    expect(qrCodeResponse.body.dataUrl).toMatch(/^data:image\/png;base64,/);

    const barcodeResponse = await request(server)
      .get(`/api/catalog/variants/barcode/${variant.barcode}`)
      .set(auth())
      .expect(200);
    expect(barcodeResponse.body.id).toBe(variant.id);

    await request(server)
      .post("/api/inventory/movements")
      .set(auth())
      .send({ variantId: variant.id, type: "OUT", quantity: 6, reason: "venda balcão" })
      .expect(201);

    const openAlerts = await request(server)
      .get("/api/inventory/alerts?resolved=false")
      .set(auth())
      .expect(200);
    const lowStockAlert = openAlerts.body.find((a: { type: string }) => a.type === "LOW_STOCK");
    expect(lowStockAlert).toBeDefined();

    await request(server)
      .patch(`/api/inventory/alerts/${lowStockAlert.id}/resolve`)
      .set(auth())
      .expect(200);

    const afterResolve = await request(server)
      .get("/api/inventory/alerts?resolved=false")
      .set(auth())
      .expect(200);
    expect(afterResolve.body.find((a: { id: string }) => a.id === lowStockAlert.id)).toBeUndefined();

    const insufficientStock = await request(server)
      .post("/api/inventory/movements")
      .set(auth())
      .send({ variantId: variant.id, type: "OUT", quantity: 999 })
      .expect(400);
    expect(insufficientStock.body.message).toBeDefined();
  });
});

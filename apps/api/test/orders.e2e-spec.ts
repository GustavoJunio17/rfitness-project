import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/shared/prisma/prisma.service";

describe("Orders flow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const gymSlug = `e2e-orders-${process.hrtime.bigint()}`;

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
        gymName: "Academia Pedidos E2E",
        gymSlug,
        adminName: "Admin Pedidos",
        adminEmail: "admin@pedidos-e2e.com",
        adminPassword: "SenhaForte@123",
      });
    accessToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { slug: gymSlug } });
    await app.close();
  });

  it("creates an order, walks it through statuses, and decrements stock only on delivery", async () => {
    const server = app.getHttpServer();
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    const productResponse = await request(server)
      .post("/api/catalog/products")
      .set(auth())
      .send({
        name: "Whey Protein",
        variants: [{ costPrice: 40, salePrice: 90, minQuantity: 5, initialQuantity: 20 }],
      })
      .expect(201);
    const variant = productResponse.body.variants[0];

    const orderResponse = await request(server)
      .post("/api/orders")
      .set(auth())
      .send({
        customerName: "Maria Cliente",
        customerPhone: "5511988887777",
        deliveryType: "PICKUP",
        paymentMethod: "PIX",
        items: [{ variantId: variant.id, quantity: 3 }],
      })
      .expect(201);

    expect(orderResponse.body.status).toBe("PENDING");
    expect(orderResponse.body.totalAmount).toBe("270");
    const orderId = orderResponse.body.id;

    const openCountAfterCreate = await request(server).get("/api/orders/open-count").set(auth()).expect(200);
    expect(openCountAfterCreate.body).toBe(1);

    // Stock must not move until the order is actually delivered.
    const productAfterCreate = await request(server)
      .get(`/api/catalog/products/${productResponse.body.id}`)
      .set(auth())
      .expect(200);
    expect(productAfterCreate.body.variants[0].currentQuantity).toBe(20);

    await request(server)
      .patch(`/api/orders/${orderId}/status`)
      .set(auth())
      .send({ status: "DELIVERED" })
      .expect(400); // can't skip SEPARATING/OUT_FOR_DELIVERY

    await request(server).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status: "SEPARATING" }).expect(200);
    await request(server)
      .patch(`/api/orders/${orderId}/status`)
      .set(auth())
      .send({ status: "OUT_FOR_DELIVERY" })
      .expect(200);

    const deliveredResponse = await request(server)
      .patch(`/api/orders/${orderId}/status`)
      .set(auth())
      .send({ status: "DELIVERED" })
      .expect(200);
    expect(deliveredResponse.body.status).toBe("DELIVERED");

    const productAfterDelivery = await request(server)
      .get(`/api/catalog/products/${productResponse.body.id}`)
      .set(auth())
      .expect(200);
    expect(productAfterDelivery.body.variants[0].currentQuantity).toBe(17);

    const movements = await request(server)
      .get(`/api/inventory/movements?variantId=${variant.id}`)
      .set(auth())
      .expect(200);
    const orderMovement = movements.body.find((m: { type: string }) => m.type === "OUT");
    expect(orderMovement).toBeDefined();
    expect(orderMovement.quantity).toBe(-3);

    await request(server)
      .patch(`/api/orders/${orderId}/status`)
      .set(auth())
      .send({ status: "CANCELLED" })
      .expect(400); // DELIVERED is terminal

    const openCountAfterDelivery = await request(server).get("/api/orders/open-count").set(auth()).expect(200);
    expect(openCountAfterDelivery.body).toBe(0);
  });

  it("rejects creating an order for a SKU that does not belong to the gym", async () => {
    const server = app.getHttpServer();
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    await request(server)
      .post("/api/orders")
      .set(auth())
      .send({
        customerName: "Cliente Fantasma",
        customerPhone: "5511900000000",
        deliveryType: "PICKUP",
        paymentMethod: "CASH",
        items: [{ variantId: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
      })
      .expect(404);
  });
});

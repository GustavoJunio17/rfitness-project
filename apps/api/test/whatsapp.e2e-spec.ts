import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/shared/prisma/prisma.service";

// Full happy-path coverage (a real inbound message → Claude → Evolution API reply)
// needs a live ANTHROPIC_API_KEY and Evolution API instance, neither available in
// this environment — this suite only covers what's reachable without them: the
// admin settings endpoint and the webhook's token-based auth (fail-closed when no
// shared secret is configured, which is the default in a fresh .env).
describe("WhatsApp settings + webhook auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const gymSlug = `e2e-whatsapp-${process.hrtime.bigint()}`;

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
        gymName: "Academia WhatsApp E2E",
        gymSlug,
        adminName: "Admin WhatsApp",
        adminEmail: "admin@whatsapp-e2e.com",
        adminPassword: "SenhaForte@123",
      });
    accessToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { slug: gymSlug } });
    await app.close();
  });

  it("lets an admin configure the WhatsApp instance name for their gym", async () => {
    const server = app.getHttpServer();
    const instanceName = `${gymSlug}-instance`;

    await request(server)
      .patch("/api/whatsapp/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ whatsappInstanceName: instanceName })
      .expect(200);

    const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
    expect(gym?.whatsappInstanceName).toBe(instanceName);
  });

  it("rejects webhook calls without the shared-secret token", async () => {
    await request(app.getHttpServer())
      .post("/api/whatsapp/webhook")
      .send({ instance: "whatever", data: {} })
      .expect(401);
  });

  it("rejects webhook calls when no shared secret is configured (fails closed)", async () => {
    await request(app.getHttpServer())
      .post("/api/whatsapp/webhook?token=anything")
      .send({ instance: "whatever", data: {} })
      .expect(401);
  });

  it("requires authentication to list WhatsApp conversations", async () => {
    await request(app.getHttpServer()).get("/api/whatsapp/conversations").expect(401);
  });
});

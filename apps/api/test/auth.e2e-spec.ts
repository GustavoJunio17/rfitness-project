import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/shared/prisma/prisma.service";

describe("Auth flow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const gymSlug = `e2e-gym-${process.hrtime.bigint()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { slug: gymSlug } });
    await app.close();
  });

  it("registers a gym, logs in, refreshes and logs out", async () => {
    const server = app.getHttpServer();

    const registerResponse = await request(server)
      .post("/api/auth/register-gym")
      .send({
        gymName: "Academia E2E",
        gymSlug,
        adminName: "Admin E2E",
        adminEmail: "admin@e2e.com",
        adminPassword: "SenhaForte@123",
      })
      .expect(201);

    expect(registerResponse.body.accessToken).toBeDefined();
    expect(registerResponse.body.user.roles).toContain("ADMIN");

    const loginResponse = await request(server)
      .post("/api/auth/login")
      .send({ gymSlug, email: "admin@e2e.com", password: "SenhaForte@123" })
      .expect(200);

    expect(loginResponse.body.accessToken).toBeDefined();
    const { refreshToken, accessToken } = loginResponse.body;

    const meResponse = await request(server)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(meResponse.body.email).toBe("admin@e2e.com");

    const wrongLogin = await request(server)
      .post("/api/auth/login")
      .send({ gymSlug, email: "admin@e2e.com", password: "senha-errada" })
      .expect(401);
    expect(wrongLogin.body.message).toBeDefined();

    const refreshResponse = await request(server)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(200);
    expect(refreshResponse.body.accessToken).toBeDefined();
    const rotatedRefreshToken = refreshResponse.body.refreshToken;

    await request(server).post("/api/auth/refresh").send({ refreshToken }).expect(401);

    await request(server).post("/api/auth/logout").send({ refreshToken: rotatedRefreshToken }).expect(204);

    await request(server)
      .post("/api/auth/refresh")
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401);

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: { in: ["auth.register_gym", "auth.login"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(auditEntries.length).toBeGreaterThan(0);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    await request(app.getHttpServer()).get("/api/auth/me").expect(401);
    await request(app.getHttpServer()).get("/api/health").expect(200);
  });
});

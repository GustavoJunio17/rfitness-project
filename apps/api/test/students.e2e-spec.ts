import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/shared/prisma/prisma.service";

describe("Students flow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const gymSlug = `e2e-students-${process.hrtime.bigint()}`;

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
        gymName: "Academia Alunos E2E",
        gymSlug,
        adminName: "Admin Alunos",
        adminEmail: "admin@alunos-e2e.com",
        adminPassword: "SenhaForte@123",
      });
    accessToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { slug: gymSlug } });
    await app.close();
  });

  it("creates a plan, enrolls a student, and tracks goals/notes", async () => {
    const server = app.getHttpServer();
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    const planResponse = await request(server)
      .post("/api/students/plans")
      .set(auth())
      .send({ name: "Mensal", price: 129.9, durationDays: 30 })
      .expect(201);

    const studentResponse = await request(server)
      .post("/api/students")
      .set(auth())
      .send({ name: "Maria Aluna", whatsapp: "5511999990000" })
      .expect(201);
    expect(studentResponse.body.status).toBe("ACTIVE");

    const enrollResponse = await request(server)
      .post(`/api/students/${studentResponse.body.id}/enroll`)
      .set(auth())
      .send({ planId: planResponse.body.id })
      .expect(201);
    const expectedDueDate = new Date(
      new Date(enrollResponse.body.startDate).getTime() + 30 * 86_400_000,
    ).toISOString().slice(0, 10);
    expect(new Date(enrollResponse.body.dueDate).toISOString().slice(0, 10)).toBe(expectedDueDate);

    const goalResponse = await request(server)
      .post(`/api/students/${studentResponse.body.id}/goals`)
      .set(auth())
      .send({ description: "Perder 5kg" })
      .expect(201);

    await request(server)
      .patch(`/api/students/goals/${goalResponse.body.id}`)
      .set(auth())
      .send({ achieved: true })
      .expect(200);

    await request(server)
      .post(`/api/students/${studentResponse.body.id}/notes`)
      .set(auth())
      .send({ content: "Aluna prefere treinos pela manhã." })
      .expect(201);

    const detail = await request(server)
      .get(`/api/students/${studentResponse.body.id}`)
      .set(auth())
      .expect(200);
    expect(detail.body.subscriptions).toHaveLength(1);
    expect(detail.body.goals[0].achieved).toBe(true);
    expect(detail.body.studentNotes).toHaveLength(1);

    const financeSummary = await request(server).get("/api/finance/summary").set(auth()).expect(200);
    expect(financeSummary.body.students.active).toBeGreaterThanOrEqual(1);
    expect(financeSummary.body.students.newThisMonth).toBeGreaterThanOrEqual(1);
  });

  it("does not let two students in the same gym share a CPF", async () => {
    const server = app.getHttpServer();
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    await request(server)
      .post("/api/students")
      .set(auth())
      .send({ name: "Aluno Um", cpf: "11122233344" })
      .expect(201);

    await request(server)
      .post("/api/students")
      .set(auth())
      .send({ name: "Aluno Dois", cpf: "11122233344" })
      .expect(409);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createStudentsService } from "./students.service";
import type { StudentRecord, StudentsRepository, StudentsSideEffects } from "./students.ports";

const student = (overrides: Partial<StudentRecord> = {}): StudentRecord => ({
  id: "student-1",
  name: "Ana Souza",
  cpf: "11122233344",
  phone: "5531999991111",
  whatsapp: "5531999991111",
  email: null,
  address: null,
  trainerName: null,
  status: "ACTIVE",
  enrollmentDate: new Date("2026-01-10T00:00:00.000Z"),
  notes: null,
  createdAt: new Date("2026-01-10T00:00:00.000Z"),
  subscriptions: [],
  goals: [],
  studentNotes: [],
  ...overrides,
});

function makeRepo(overrides: Partial<StudentsRepository> = {}): StudentsRepository {
  return {
    findMany: vi.fn().mockResolvedValue([student()]),
    findById: vi.fn().mockResolvedValue(student()),
    findByPhone: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(student()),
    update: vi.fn().mockResolvedValue(student()),
    updateStatus: vi.fn().mockResolvedValue(student({ status: "SUSPENDED" })),
    delete: vi.fn().mockResolvedValue(undefined),
    findPlan: vi.fn().mockResolvedValue({ id: "plan-1", name: "Mensal", durationDays: 30, price: 129.9 }),
    createSubscription: vi.fn().mockResolvedValue({
      id: "sub-1",
      planId: "plan-1",
      planName: "Mensal",
      startDate: new Date("2026-07-29T00:00:00.000Z"),
      dueDate: new Date("2026-08-28T00:00:00.000Z"),
      cancelledAt: null,
    }),
    addGoal: vi.fn().mockResolvedValue({
      id: "goal-1",
      description: "Ganhar 3kg",
      targetDate: null,
      achieved: false,
    }),
    updateGoal: vi.fn().mockResolvedValue({
      id: "goal-1",
      description: "Ganhar 3kg",
      targetDate: null,
      achieved: true,
    }),
    addNote: vi.fn().mockResolvedValue({
      id: "note-1",
      content: "Prefere treinar de manhã",
      createdAt: new Date(),
    }),
    ...overrides,
  };
}

function makeSideEffects(overrides: Partial<StudentsSideEffects> = {}): StudentsSideEffects {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn().mockResolvedValue(undefined),
    sendWelcomeMessage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createStudent", () => {
  it("cria e dispara boas-vindas no WhatsApp", async () => {
    const repo = makeRepo();
    const sideEffects = makeSideEffects();
    const service = createStudentsService(repo, sideEffects);

    await service.createStudent("gym-1", { name: "Ana Souza", whatsapp: "5531999991111" });

    expect(repo.create).toHaveBeenCalledWith("gym-1", expect.objectContaining({ name: "Ana Souza" }));
    expect(sideEffects.sendWelcomeMessage).toHaveBeenCalledWith("gym-1", "student-1");
    expect(sideEffects.notify).toHaveBeenCalledWith(
      "gym-1",
      "NEW_STUDENT",
      "Novo aluno",
      "Ana Souza foi cadastrado(a).",
    );
    expect(sideEffects.publish).toHaveBeenCalledWith("gym-1", "student.created", { studentId: "student-1" });
  });

  it("falha no envio da mensagem não impede o cadastro", async () => {
    const sideEffects = makeSideEffects({
      sendWelcomeMessage: vi.fn().mockRejectedValue(new Error("Evolution API fora do ar")),
    });
    const service = createStudentsService(makeRepo(), sideEffects);

    await expect(service.createStudent("gym-1", { name: "Ana Souza" })).resolves.toMatchObject({
      id: "student-1",
    });
  });
});

describe("enrollStudent", () => {
  it("calcula o vencimento a partir da duração do plano", async () => {
    const repo = makeRepo();
    const service = createStudentsService(repo, makeSideEffects());

    await service.enrollStudent("gym-1", "student-1", {
      planId: "plan-1",
      startDate: "2026-07-29T00:00:00.000Z",
    });

    expect(repo.createSubscription).toHaveBeenCalledWith({
      studentId: "student-1",
      planId: "plan-1",
      startDate: new Date("2026-07-29T00:00:00.000Z"),
      dueDate: new Date("2026-08-28T00:00:00.000Z"),
    });
  });

  it("recusa plano de outra academia", async () => {
    const repo = makeRepo({ findPlan: vi.fn().mockResolvedValue(null) });
    const service = createStudentsService(repo, makeSideEffects());

    await expect(
      service.enrollStudent("gym-1", "student-1", { planId: "plan-x" }),
    ).rejects.toThrow(/plano não encontrado/i);
  });

  it("recusa aluno de outra academia", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = createStudentsService(repo, makeSideEffects());

    await expect(
      service.enrollStudent("gym-1", "student-x", { planId: "plan-1" }),
    ).rejects.toThrow(/aluno não encontrado/i);
  });
});

describe("status derivado", () => {
  const overdueSubscription = {
    id: "sub-1",
    planId: "plan-1",
    planName: "Mensal",
    startDate: new Date("2026-05-01T00:00:00.000Z"),
    dueDate: new Date("2026-06-01T00:00:00.000Z"),
    cancelledAt: null,
  };

  it("marca OVERDUE na listagem quando a matrícula venceu", async () => {
    const repo = makeRepo({
      findMany: vi.fn().mockResolvedValue([student({ subscriptions: [overdueSubscription] })]),
    });
    const service = createStudentsService(repo, makeSideEffects());

    const [listed] = await service.listStudents("gym-1", {}, new Date("2026-07-29T00:00:00.000Z"));
    expect(listed?.status).toBe("OVERDUE");
  });

  it("não sobrescreve status manual SUSPENDED", async () => {
    const repo = makeRepo({
      findMany: vi
        .fn()
        .mockResolvedValue([student({ status: "SUSPENDED", subscriptions: [overdueSubscription] })]),
    });
    const service = createStudentsService(repo, makeSideEffects());

    const [listed] = await service.listStudents("gym-1", {}, new Date("2026-07-29T00:00:00.000Z"));
    expect(listed?.status).toBe("SUSPENDED");
  });
});

describe("metas e observações", () => {
  it("recusa meta para aluno inexistente na academia", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = createStudentsService(repo, makeSideEffects());

    await expect(service.addGoal("gym-1", "student-x", { description: "x" })).rejects.toThrow(
      /não encontrado/i,
    );
  });

  it("marca meta como concluída", async () => {
    const repo = makeRepo();
    const service = createStudentsService(repo, makeSideEffects());

    const goal = await service.updateGoal("gym-1", "goal-1", { achieved: true });
    expect(repo.updateGoal).toHaveBeenCalledWith("gym-1", "goal-1", { achieved: true });
    expect(goal.achieved).toBe(true);
  });
});

describe("findByPhone", () => {
  it("normaliza o telefone antes de buscar (agente do WhatsApp)", async () => {
    const repo = makeRepo();
    const service = createStudentsService(repo, makeSideEffects());

    await service.findByPhone("gym-1", "+55 (31) 99999-1111");

    expect(repo.findByPhone).toHaveBeenCalledWith("gym-1", "5531999991111");
  });
});

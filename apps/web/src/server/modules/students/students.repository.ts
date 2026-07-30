import { Prisma, type StudentStatus } from "@prisma/client";
import { notFoundError, toNumber } from "@rfitness/core";
import { prisma } from "../../db";
import { publishRealtime } from "../../realtime/publisher";
import { createNotification } from "../notifications/notifications.service";
import { createStudentsService } from "./students.service";
import type {
  GoalRecord,
  NoteRecord,
  PlanRecord,
  StudentFilters,
  StudentRecord,
  StudentWriteInput,
  StudentsRepository,
  StudentsSideEffects,
  SubscriptionRecord,
} from "./students.ports";

const studentInclude = {
  subscriptions: {
    include: { plan: { select: { name: true } } },
    orderBy: { dueDate: "desc" },
  },
  goals: { orderBy: { createdAt: "desc" } },
  studentNotes: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.StudentInclude;

type StudentWithRelations = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

function toStudentRecord(student: StudentWithRelations): StudentRecord {
  return {
    id: student.id,
    name: student.name,
    cpf: student.cpf,
    phone: student.phone,
    whatsapp: student.whatsapp,
    email: student.email,
    address: student.address,
    trainerName: student.trainerName,
    status: student.status,
    enrollmentDate: student.enrollmentDate,
    notes: student.notes,
    createdAt: student.createdAt,
    subscriptions: student.subscriptions.map((subscription) => ({
      id: subscription.id,
      planId: subscription.planId,
      planName: subscription.plan.name,
      startDate: subscription.startDate,
      dueDate: subscription.dueDate,
      cancelledAt: subscription.cancelledAt,
    })),
    goals: student.goals.map((goal) => ({
      id: goal.id,
      description: goal.description,
      targetDate: goal.targetDate,
      achieved: goal.achieved,
    })),
    studentNotes: student.studentNotes.map((note) => ({
      id: note.id,
      content: note.content,
      createdAt: note.createdAt,
    })),
  };
}

export const prismaStudentsRepository: StudentsRepository = {
  async findMany(gymId: string, filters: StudentFilters): Promise<StudentRecord[]> {
    const students = await prisma.student.findMany({
      where: {
        gymId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { cpf: { contains: filters.search } },
                { phone: { contains: filters.search } },
                { whatsapp: { contains: filters.search } },
              ],
            }
          : {}),
      },
      include: studentInclude,
      orderBy: { name: "asc" },
      take: filters.limit ?? 200,
    });

    return students.map(toStudentRecord);
  },

  async findById(gymId: string, id: string): Promise<StudentRecord | null> {
    const student = await prisma.student.findFirst({ where: { id, gymId }, include: studentInclude });
    return student ? toStudentRecord(student) : null;
  },

  async findByPhone(gymId: string, phone: string): Promise<StudentRecord | null> {
    const student = await prisma.student.findFirst({
      where: { gymId, OR: [{ whatsapp: phone }, { phone }] },
      include: studentInclude,
    });
    return student ? toStudentRecord(student) : null;
  },

  async create(gymId: string, input: StudentWriteInput): Promise<StudentRecord> {
    const student = await prisma.student.create({
      data: {
        gymId,
        name: input.name,
        cpf: input.cpf ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        trainerName: input.trainerName ?? null,
        notes: input.notes ?? null,
      },
      include: studentInclude,
    });
    return toStudentRecord(student);
  },

  async update(gymId: string, id: string, input: Partial<StudentWriteInput>): Promise<StudentRecord> {
    const { count } = await prisma.student.updateMany({ where: { id, gymId }, data: input });
    if (count === 0) throw notFoundError("Aluno não encontrado.");

    const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: studentInclude });
    return toStudentRecord(student);
  },

  async updateStatus(gymId: string, id: string, status: StudentStatus): Promise<StudentRecord> {
    const { count } = await prisma.student.updateMany({ where: { id, gymId }, data: { status } });
    if (count === 0) throw notFoundError("Aluno não encontrado.");

    const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: studentInclude });
    return toStudentRecord(student);
  },

  async delete(gymId: string, id: string): Promise<void> {
    const { count } = await prisma.student.deleteMany({ where: { id, gymId } });
    if (count === 0) throw notFoundError("Aluno não encontrado.");
  },

  async findPlan(gymId: string, planId: string): Promise<PlanRecord | null> {
    const plan = await prisma.plan.findFirst({
      where: { id: planId, gymId, isActive: true },
      select: { id: true, name: true, durationDays: true, price: true },
    });
    if (!plan) return null;
    return { id: plan.id, name: plan.name, durationDays: plan.durationDays, price: toNumber(plan.price) };
  },

  async createSubscription(input: {
    studentId: string;
    planId: string;
    startDate: Date;
    dueDate: Date;
  }): Promise<SubscriptionRecord> {
    const subscription = await prisma.subscription.create({
      data: input,
      include: { plan: { select: { name: true } } },
    });

    return {
      id: subscription.id,
      planId: subscription.planId,
      planName: subscription.plan.name,
      startDate: subscription.startDate,
      dueDate: subscription.dueDate,
      cancelledAt: subscription.cancelledAt,
    };
  },

  async addGoal(
    studentId: string,
    input: { description: string; targetDate?: Date | null },
  ): Promise<GoalRecord> {
    const goal = await prisma.studentGoal.create({
      data: { studentId, description: input.description, targetDate: input.targetDate ?? null },
    });
    return {
      id: goal.id,
      description: goal.description,
      targetDate: goal.targetDate,
      achieved: goal.achieved,
    };
  },

  async updateGoal(
    gymId: string,
    goalId: string,
    input: { description?: string; targetDate?: Date | null; achieved?: boolean },
  ): Promise<GoalRecord> {
    const existing = await prisma.studentGoal.findFirst({
      where: { id: goalId, student: { gymId } },
      select: { id: true },
    });
    if (!existing) throw notFoundError("Meta não encontrada.");

    const goal = await prisma.studentGoal.update({ where: { id: goalId }, data: input });
    return {
      id: goal.id,
      description: goal.description,
      targetDate: goal.targetDate,
      achieved: goal.achieved,
    };
  },

  async addNote(studentId: string, content: string): Promise<NoteRecord> {
    const note = await prisma.studentNote.create({ data: { studentId, content } });
    return { id: note.id, content: note.content, createdAt: note.createdAt };
  },
};

export const studentsSideEffects: StudentsSideEffects = {
  publish: publishRealtime,
  notify: createNotification,
  /**
   * Import dinâmico de propósito: `whatsapp` já depende de `students` (para
   * identificar o contato), então importar estaticamente aqui fecharia um ciclo.
   */
  async sendWelcomeMessage(gymId: string, studentId: string) {
    const { whatsAppService } = await import("../whatsapp/whatsapp.wiring");
    await whatsAppService.sendWelcomeMessage(gymId, studentId);
  },
};

export const studentsService = createStudentsService(prismaStudentsRepository, studentsSideEffects);

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  Student,
  StudentDetail,
  StudentFilters,
  StudentGoal,
  StudentInput,
  StudentNote,
  StudentRepository,
  StudentStatus,
  StudentSubscription,
} from "../../domain/repositories/student.repository";

type PrismaStudent = Prisma.StudentGetPayload<Record<string, never>>;
type PrismaStudentDetail = Prisma.StudentGetPayload<{
  include: {
    subscriptions: { include: { plan: true } };
    goals: true;
    studentNotes: true;
  };
}>;

@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(gymId: string, input: StudentInput): Promise<Student> {
    try {
      const student = await this.prisma.student.create({ data: { gymId, ...input } });
      return this.toDomain(student);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Já existe um aluno com este CPF nesta academia.");
      }
      throw error;
    }
  }

  async findAll(gymId: string, filters: StudentFilters): Promise<Student[]> {
    const students = await this.prisma.student.findMany({
      where: {
        gymId,
        status: filters.status,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: "insensitive" } },
              { cpf: { contains: filters.search } },
              { phone: { contains: filters.search } },
            ]
          : undefined,
      },
      orderBy: { name: "asc" },
    });
    return students.map((student) => this.toDomain(student));
  }

  async findById(gymId: string, id: string): Promise<StudentDetail | null> {
    const student = await this.prisma.student.findFirst({
      where: { id, gymId },
      include: {
        subscriptions: { include: { plan: true }, orderBy: { startDate: "desc" } },
        goals: { orderBy: { createdAt: "desc" } },
        studentNotes: { orderBy: { createdAt: "desc" } },
      },
    });
    return student ? this.toDetailDomain(student) : null;
  }

  async findByPhone(gymId: string, phone: string): Promise<Student | null> {
    const student = await this.prisma.student.findFirst({
      where: { gymId, OR: [{ phone }, { whatsapp: phone }] },
    });
    return student ? this.toDomain(student) : null;
  }

  async update(gymId: string, id: string, input: Partial<StudentInput>): Promise<Student> {
    await this.assertExists(gymId, id);
    const student = await this.prisma.student.update({ where: { id }, data: input });
    return this.toDomain(student);
  }

  async updateStatus(gymId: string, id: string, status: StudentStatus): Promise<void> {
    await this.assertExists(gymId, id);
    await this.prisma.student.update({ where: { id }, data: { status } });
  }

  async delete(gymId: string, id: string): Promise<void> {
    await this.assertExists(gymId, id);
    await this.prisma.student.delete({ where: { id } });
  }

  async enroll(gymId: string, studentId: string, planId: string): Promise<StudentSubscription> {
    await this.assertExists(gymId, studentId);
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, gymId } });
    if (!plan) throw new NotFoundException("Plano não encontrado.");

    const startDate = new Date();
    const dueDate = new Date(startDate.getTime() + plan.durationDays * 86_400_000);

    const subscription = await this.prisma.subscription.create({
      data: { studentId, planId, startDate, dueDate },
      include: { plan: true },
    });
    return this.toSubscriptionDomain(subscription);
  }

  async addGoal(gymId: string, studentId: string, description: string, targetDate?: Date): Promise<StudentGoal> {
    await this.assertExists(gymId, studentId);
    const goal = await this.prisma.studentGoal.create({ data: { studentId, description, targetDate } });
    return this.toGoalDomain(goal);
  }

  async markGoalAchieved(gymId: string, goalId: string, achieved: boolean): Promise<void> {
    const goal = await this.prisma.studentGoal.findFirst({ where: { id: goalId, student: { gymId } } });
    if (!goal) throw new NotFoundException("Meta não encontrada.");
    await this.prisma.studentGoal.update({ where: { id: goalId }, data: { achieved } });
  }

  async addNote(gymId: string, studentId: string, content: string): Promise<StudentNote> {
    await this.assertExists(gymId, studentId);
    const note = await this.prisma.studentNote.create({ data: { studentId, content } });
    return this.toNoteDomain(note);
  }

  countByStatus(gymId: string, status: StudentStatus): Promise<number> {
    return this.prisma.student.count({ where: { gymId, status } });
  }

  countEnrolledSince(gymId: string, since: Date): Promise<number> {
    return this.prisma.student.count({ where: { gymId, enrollmentDate: { gte: since } } });
  }

  async findAllEnrolledBetween(from: Date, to: Date): Promise<Student[]> {
    const students = await this.prisma.student.findMany({
      where: { enrollmentDate: { gte: from, lt: to } },
    });
    return students.map((student) => this.toDomain(student));
  }

  private async assertExists(gymId: string, id: string): Promise<void> {
    const student = await this.prisma.student.findFirst({ where: { id, gymId } });
    if (!student) throw new NotFoundException("Aluno não encontrado.");
  }

  private toDomain(student: PrismaStudent): Student {
    return {
      id: student.id,
      gymId: student.gymId,
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
    };
  }

  private toDetailDomain(student: PrismaStudentDetail): StudentDetail {
    return {
      ...this.toDomain(student),
      subscriptions: student.subscriptions.map((sub) => this.toSubscriptionDomain(sub)),
      goals: student.goals.map((goal) => this.toGoalDomain(goal)),
      studentNotes: student.studentNotes.map((note) => this.toNoteDomain(note)),
    };
  }

  private toSubscriptionDomain(subscription: {
    id: string;
    planId: string;
    plan: { name: string };
    startDate: Date;
    dueDate: Date;
    cancelledAt: Date | null;
  }): StudentSubscription {
    return {
      id: subscription.id,
      planId: subscription.planId,
      planName: subscription.plan.name,
      startDate: subscription.startDate,
      dueDate: subscription.dueDate,
      cancelledAt: subscription.cancelledAt,
    };
  }

  private toGoalDomain(goal: {
    id: string;
    description: string;
    targetDate: Date | null;
    achieved: boolean;
  }): StudentGoal {
    return { id: goal.id, description: goal.description, targetDate: goal.targetDate, achieved: goal.achieved };
  }

  private toNoteDomain(note: { id: string; content: string; createdAt: Date }): StudentNote {
    return { id: note.id, content: note.content, createdAt: note.createdAt };
  }
}

import type { StudentStatus } from "@prisma/client";
import { computeDueDate, deriveStudentStatus, notFoundError } from "@rfitness/core";
import type {
  GoalRecord,
  NoteRecord,
  StudentFilters,
  StudentRecord,
  StudentWriteInput,
  StudentsRepository,
  StudentsSideEffects,
  SubscriptionRecord,
} from "./students.ports";

/** Telefone só com dígitos — é assim que o WhatsApp entrega o número. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * CPF também vai para o banco só com dígitos. A tela manda mascarado ou cru
 * conforme o campo, e outros clientes da API mandam o que quiserem — guardar
 * um formato só é o que faz a busca por CPF encontrar o mesmo aluno nos dois
 * casos.
 */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export interface EnrollInput {
  planId: string;
  startDate?: string;
}

export function createStudentsService(repository: StudentsRepository, sideEffects: StudentsSideEffects) {
  /**
   * ACTIVE/OVERDUE são derivados das matrículas a cada leitura, em vez de
   * depender de um job noturno que marca vencidos — assim o painel nunca mostra
   * "em dia" para quem venceu há uma hora.
   */
  function withDerivedStatus(student: StudentRecord, now: Date): StudentRecord {
    return {
      ...student,
      status: deriveStudentStatus(
        student.status,
        student.subscriptions.map((subscription) => ({
          dueDate: subscription.dueDate,
          cancelledAt: subscription.cancelledAt,
        })),
        now,
      ),
    };
  }

  async function listStudents(
    gymId: string,
    filters: StudentFilters,
    now = new Date(),
  ): Promise<StudentRecord[]> {
    const students = await repository.findMany(gymId, filters);
    return students.map((student) => withDerivedStatus(student, now));
  }

  async function getStudent(gymId: string, id: string, now = new Date()): Promise<StudentRecord> {
    const student = await repository.findById(gymId, id);
    if (!student) throw notFoundError("Aluno não encontrado.");
    return withDerivedStatus(student, now);
  }

  async function findByPhone(gymId: string, phone: string): Promise<StudentRecord | null> {
    return repository.findByPhone(gymId, normalizePhone(phone));
  }

  async function createStudent(gymId: string, input: StudentWriteInput): Promise<StudentRecord> {
    const student = await repository.create(gymId, {
      ...input,
      cpf: input.cpf ? normalizeCpf(input.cpf) : null,
      phone: input.phone ? normalizePhone(input.phone) : null,
      whatsapp: input.whatsapp ? normalizePhone(input.whatsapp) : null,
    });

    // Boas-vindas + notificação são efeitos colaterais: cadastro já commitado.
    try {
      await sideEffects.publish(gymId, "student.created", { studentId: student.id });
      await sideEffects.notify(gymId, "NEW_STUDENT", "Novo aluno", `${student.name} foi cadastrado(a).`);
      await sideEffects.sendWelcomeMessage(gymId, student.id);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[students] efeito colateral pós-cadastro falhou para ${student.id}:`, error);
    }

    return student;
  }

  async function updateStudent(
    gymId: string,
    id: string,
    input: Partial<StudentWriteInput>,
  ): Promise<StudentRecord> {
    await getStudent(gymId, id);
    return repository.update(gymId, id, {
      ...input,
      ...(input.cpf !== undefined ? { cpf: input.cpf ? normalizeCpf(input.cpf) : null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ? normalizePhone(input.phone) : null } : {}),
      ...(input.whatsapp !== undefined
        ? { whatsapp: input.whatsapp ? normalizePhone(input.whatsapp) : null }
        : {}),
    });
  }

  async function updateStatus(gymId: string, id: string, status: StudentStatus): Promise<StudentRecord> {
    await getStudent(gymId, id);
    return repository.updateStatus(gymId, id, status);
  }

  async function deleteStudent(gymId: string, id: string): Promise<void> {
    await getStudent(gymId, id);
    await repository.delete(gymId, id);
  }

  async function enrollStudent(
    gymId: string,
    studentId: string,
    input: EnrollInput,
  ): Promise<SubscriptionRecord> {
    const student = await repository.findById(gymId, studentId);
    if (!student) throw notFoundError("Aluno não encontrado.");

    const plan = await repository.findPlan(gymId, input.planId);
    if (!plan) throw notFoundError("Plano não encontrado.");

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    return repository.createSubscription({
      studentId,
      planId: plan.id,
      startDate,
      dueDate: computeDueDate(startDate, plan.durationDays),
    });
  }

  async function addGoal(
    gymId: string,
    studentId: string,
    input: { description: string; targetDate?: string | null },
  ): Promise<GoalRecord> {
    const student = await repository.findById(gymId, studentId);
    if (!student) throw notFoundError("Aluno não encontrado.");

    return repository.addGoal(studentId, {
      description: input.description,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
    });
  }

  function updateGoal(
    gymId: string,
    goalId: string,
    input: { description?: string; targetDate?: string | null; achieved?: boolean },
  ): Promise<GoalRecord> {
    return repository.updateGoal(gymId, goalId, {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.targetDate !== undefined
        ? { targetDate: input.targetDate ? new Date(input.targetDate) : null }
        : {}),
      ...(input.achieved !== undefined ? { achieved: input.achieved } : {}),
    });
  }

  async function addNote(gymId: string, studentId: string, content: string): Promise<NoteRecord> {
    const student = await repository.findById(gymId, studentId);
    if (!student) throw notFoundError("Aluno não encontrado.");
    return repository.addNote(studentId, content);
  }

  return {
    listStudents,
    getStudent,
    findByPhone,
    createStudent,
    updateStudent,
    updateStatus,
    deleteStudent,
    enrollStudent,
    addGoal,
    updateGoal,
    addNote,
  };
}

export type StudentsService = ReturnType<typeof createStudentsService>;

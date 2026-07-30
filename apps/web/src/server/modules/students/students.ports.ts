import type { NotificationType, StudentStatus } from "@prisma/client";
import type { RealtimeEventType } from "../../realtime/signal";

export interface SubscriptionRecord {
  id: string;
  planId: string;
  planName: string;
  startDate: Date;
  dueDate: Date;
  cancelledAt: Date | null;
}

export interface GoalRecord {
  id: string;
  description: string;
  targetDate: Date | null;
  achieved: boolean;
}

export interface NoteRecord {
  id: string;
  content: string;
  createdAt: Date;
}

export interface StudentRecord {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  trainerName: string | null;
  status: StudentStatus;
  enrollmentDate: Date;
  notes: string | null;
  createdAt: Date;
  subscriptions: SubscriptionRecord[];
  goals: GoalRecord[];
  studentNotes: NoteRecord[];
}

export interface StudentFilters {
  search?: string;
  status?: StudentStatus;
  limit?: number;
}

export interface StudentWriteInput {
  name: string;
  cpf?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  trainerName?: string | null;
  notes?: string | null;
}

export interface PlanRecord {
  id: string;
  name: string;
  durationDays: number;
  price: number;
}

export interface StudentsRepository {
  findMany(gymId: string, filters: StudentFilters): Promise<StudentRecord[]>;
  findById(gymId: string, id: string): Promise<StudentRecord | null>;
  findByPhone(gymId: string, phone: string): Promise<StudentRecord | null>;
  create(gymId: string, input: StudentWriteInput): Promise<StudentRecord>;
  update(gymId: string, id: string, input: Partial<StudentWriteInput>): Promise<StudentRecord>;
  updateStatus(gymId: string, id: string, status: StudentStatus): Promise<StudentRecord>;
  delete(gymId: string, id: string): Promise<void>;
  findPlan(gymId: string, planId: string): Promise<PlanRecord | null>;
  createSubscription(input: {
    studentId: string;
    planId: string;
    startDate: Date;
    dueDate: Date;
  }): Promise<SubscriptionRecord>;
  addGoal(
    studentId: string,
    input: { description: string; targetDate?: Date | null },
  ): Promise<GoalRecord>;
  updateGoal(
    gymId: string,
    goalId: string,
    input: { description?: string; targetDate?: Date | null; achieved?: boolean },
  ): Promise<GoalRecord>;
  addNote(studentId: string, content: string): Promise<NoteRecord>;
}

export interface StudentsSideEffects {
  publish(gymId: string, type: RealtimeEventType, payload?: Record<string, unknown>): Promise<void>;
  notify(gymId: string, type: NotificationType, title: string, message: string): Promise<void>;
  /** Boas-vindas pelo agente de WhatsApp — desacoplado para não criar ciclo. */
  sendWelcomeMessage(gymId: string, studentId: string): Promise<void>;
}

export const STUDENT_REPOSITORY = Symbol("STUDENT_REPOSITORY");

export type StudentStatus = "ACTIVE" | "OVERDUE" | "SUSPENDED" | "CANCELLED";

export interface Student {
  id: string;
  gymId: string;
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
}

export interface StudentSubscription {
  id: string;
  planId: string;
  planName: string;
  startDate: Date;
  dueDate: Date;
  cancelledAt: Date | null;
}

export interface StudentGoal {
  id: string;
  description: string;
  targetDate: Date | null;
  achieved: boolean;
}

export interface StudentNote {
  id: string;
  content: string;
  createdAt: Date;
}

export interface StudentDetail extends Student {
  subscriptions: StudentSubscription[];
  goals: StudentGoal[];
  studentNotes: StudentNote[];
}

export interface StudentInput {
  name: string;
  cpf?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  trainerName?: string;
  notes?: string;
}

export interface StudentFilters {
  search?: string;
  status?: StudentStatus;
}

export interface StudentRepository {
  create(gymId: string, input: StudentInput): Promise<Student>;
  findAll(gymId: string, filters: StudentFilters): Promise<Student[]>;
  findById(gymId: string, id: string): Promise<StudentDetail | null>;
  findByPhone(gymId: string, phone: string): Promise<Student | null>;
  update(gymId: string, id: string, input: Partial<StudentInput>): Promise<Student>;
  updateStatus(gymId: string, id: string, status: StudentStatus): Promise<void>;
  delete(gymId: string, id: string): Promise<void>;

  enroll(gymId: string, studentId: string, planId: string): Promise<StudentSubscription>;
  addGoal(gymId: string, studentId: string, description: string, targetDate?: Date): Promise<StudentGoal>;
  markGoalAchieved(gymId: string, goalId: string, achieved: boolean): Promise<void>;
  addNote(gymId: string, studentId: string, content: string): Promise<StudentNote>;

  countByStatus(gymId: string, status: StudentStatus): Promise<number>;
  countEnrolledSince(gymId: string, since: Date): Promise<number>;

  /** Cross-tenant lookup used only by the WhatsApp follow-up scheduler (a system job, not a request handler). */
  findAllEnrolledBetween(from: Date, to: Date): Promise<Student[]>;
}

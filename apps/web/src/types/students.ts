export type StudentStatus = "ACTIVE" | "OVERDUE" | "SUSPENDED" | "CANCELLED";

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  isActive: boolean;
  activeSubscriptions: number;
}

export interface StudentSubscription {
  id: string;
  planId: string;
  planName: string;
  startDate: string;
  dueDate: string;
  cancelledAt: string | null;
}

export interface StudentGoal {
  id: string;
  description: string;
  targetDate: string | null;
  achieved: boolean;
}

export interface StudentNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  trainerName: string | null;
  status: StudentStatus;
  enrollmentDate: string;
  notes: string | null;
  createdAt: string;
  subscriptions: StudentSubscription[];
  goals: StudentGoal[];
  studentNotes: StudentNote[];
}

export type StudentDetail = Student;

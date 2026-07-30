import { validationError } from "../shared/errors";

export const STUDENT_STATUSES = ["ACTIVE", "OVERDUE", "SUSPENDED", "CANCELLED"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface SubscriptionWindow {
  dueDate: Date;
  cancelledAt: Date | null;
}

export function computeDueDate(startDate: Date, durationDays: number): Date {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw validationError("A duração do plano deve ser maior que zero.");
  }
  const dueDate = new Date(startDate.getTime());
  dueDate.setUTCDate(dueDate.getUTCDate() + durationDays);
  return dueDate;
}

export function isSubscriptionOverdue(subscription: SubscriptionWindow, now: Date): boolean {
  if (subscription.cancelledAt) return false;
  return subscription.dueDate.getTime() < now.getTime();
}

/**
 * ACTIVE/OVERDUE são derivados das matrículas; SUSPENDED e CANCELLED são decisão
 * manual da academia e nunca são sobrescritos por vencimento.
 */
export function deriveStudentStatus(
  currentStatus: StudentStatus,
  subscriptions: SubscriptionWindow[],
  now: Date,
): StudentStatus {
  if (currentStatus === "SUSPENDED" || currentStatus === "CANCELLED") return currentStatus;

  const active = subscriptions.filter((subscription) => !subscription.cancelledAt);
  if (active.length === 0) return "ACTIVE";

  const hasCurrent = active.some((subscription) => !isSubscriptionOverdue(subscription, now));
  return hasCurrent ? "ACTIVE" : "OVERDUE";
}

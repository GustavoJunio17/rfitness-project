export type NotificationType = "NEW_ORDER" | "PAYMENT_RECEIVED" | "LOW_STOCK" | "NEW_STUDENT" | "IMPORTANT_MESSAGE";

export interface Notification {
  id: string;
  gymId: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

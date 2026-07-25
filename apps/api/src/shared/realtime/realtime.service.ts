import { Injectable } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";

export type RealtimeEvent =
  | "sale.created"
  | "stock.alert.created"
  | "stock.alert.resolved"
  | "stock.movement.created"
  | "student.created"
  | "order.created"
  | "order.status_changed"
  | "whatsapp.message.received"
  | "notification.created";

/**
 * Thin facade in front of the Socket.io gateway so business modules depend on an
 * application-level service, not on a websocket transport detail. Payloads must
 * stay lightweight signals (ids/types) — never sensitive figures — since RBAC is
 * enforced by the REST endpoints the frontend refetches from, not by the socket.
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToGym(gymId: string, event: RealtimeEvent, payload: Record<string, unknown> = {}): void {
    this.gateway.emitToGym(gymId, event, payload);
  }
}

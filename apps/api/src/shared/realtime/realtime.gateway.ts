import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AuthenticatedUser } from "../types/authenticated-user";

function gymRoom(gymId: string): string {
  return `gym:${gymId}`;
}

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3000", credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<AuthenticatedUser>(token, {
        secret: this.configService.get<string>("jwt.accessSecret"),
      });
      client.data.gymId = payload.gymId;
      client.join(gymRoom(payload.gymId));
    } catch {
      this.logger.warn(`Conexão de socket rejeitada: token inválido (${client.id}).`);
      client.disconnect();
    }
  }

  handleDisconnect(): void {
    // Nada a limpar — o Socket.io remove o client de todas as rooms automaticamente.
  }

  emitToGym(gymId: string, event: string, payload: unknown): void {
    this.server.to(gymRoom(gymId)).emit(event, payload);
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";

export interface AuditLogEntry {
  gymId: string;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        gymId: entry.gymId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before as never,
        after: entry.after as never,
        ip: entry.ip,
        userAgent: entry.userAgent,
      },
    });
  }
}

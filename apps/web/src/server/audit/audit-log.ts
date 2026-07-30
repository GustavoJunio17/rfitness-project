import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface AuditEntry {
  gymId: string;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Trilha de auditoria das mutações. Nunca propaga erro: perder um registro de
 * auditoria é ruim, mas desfazer a operação de negócio do usuário por causa
 * disso é pior — a falha vai para o log do servidor.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        gymId: entry.gymId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        before: entry.before ?? undefined,
        after: entry.after ?? undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[audit] falha ao registrar ${entry.action}:`, error);
  }
}

/** Extrai ip/user-agent da request para anexar ao log. */
export function requestMeta(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null,
    userAgent: request.headers.get("user-agent"),
  };
}

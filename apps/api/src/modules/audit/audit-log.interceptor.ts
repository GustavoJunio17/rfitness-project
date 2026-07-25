import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { tap } from "rxjs";
import { AuditLogService } from "./audit-log.service";
import type { AuthenticatedUser } from "../../shared/types/authenticated-user";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Best-effort global audit trail: any authenticated write request is logged
 * automatically as "<Controller>.<handler>" without each module having to
 * remember to call AuditLogService itself. Pre-auth events (login, register)
 * are logged explicitly by AuthService since no request.user exists yet.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!MUTATING_METHODS.has(request.method) || !user) {
      return next.handle();
    }

    const controllerName = context.getClass().name;
    const handlerName = context.getHandler().name;

    return next.handle().pipe(
      tap(() => {
        void this.auditLog.log({
          gymId: user.gymId,
          userId: user.sub,
          action: `${controllerName}.${handlerName}`,
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        });
      }),
    );
  }
}

import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PlansController } from "./interface/http/plans.controller";
import { StudentsController } from "./interface/http/students.controller";
import { PlansService } from "./application/services/plans.service";
import { StudentsService } from "./application/services/students.service";
import { PLAN_REPOSITORY } from "./domain/repositories/plan.repository";
import { PrismaPlanRepository } from "./infrastructure/persistence/prisma-plan.repository";
import { STUDENT_REPOSITORY } from "./domain/repositories/student.repository";
import { PrismaStudentRepository } from "./infrastructure/persistence/prisma-student.repository";

// PlansController is registered before StudentsController: both sit under the
// `students` prefix and "students/plans" (2 segments) would otherwise collide
// with StudentsController's "students/:id" (also 2 segments) route matching.
@Module({
  imports: [NotificationsModule],
  controllers: [PlansController, StudentsController],
  providers: [
    PlansService,
    StudentsService,
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
    { provide: STUDENT_REPOSITORY, useClass: PrismaStudentRepository },
  ],
  exports: [StudentsService],
})
export class StudentsModule {}

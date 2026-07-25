import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";
import { NotificationsService } from "../../../notifications/application/services/notifications.service";
import {
  STUDENT_REPOSITORY,
  Student,
  StudentDetail,
  StudentFilters,
  StudentGoal,
  StudentInput,
  StudentNote,
  StudentRepository,
  StudentStatus,
  StudentSubscription,
} from "../../domain/repositories/student.repository";

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    private readonly realtimeService: RealtimeService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService?: NotificationsService,
  ) {}

  async createStudent(gymId: string, input: StudentInput): Promise<Student> {
    const student = await this.students.create(gymId, input);
    try {
      this.realtimeService.emitToGym(gymId, "student.created", { studentId: student.id });
      // Decoupled from whatsapp-ai on purpose: students has no import-time
      // dependency on it (and vice versa isn't needed either) — the listener
      // lives on the whatsapp-ai side and reacts to this internal event.
      this.eventEmitter.emit("student.created", { gymId, studentId: student.id });
      await this.notificationsService?.create(gymId, "NEW_STUDENT", "Novo aluno", `${student.name} se cadastrou.`);
    } catch (error) {
      this.logger.warn(`Falha ao emitir evento para novo aluno ${student.id}: ${error}`);
    }
    return student;
  }

  listStudents(gymId: string, filters: StudentFilters): Promise<Student[]> {
    return this.students.findAll(gymId, filters);
  }

  getStudent(gymId: string, id: string): Promise<StudentDetail | null> {
    return this.students.findById(gymId, id);
  }

  findByPhone(gymId: string, phone: string): Promise<Student | null> {
    return this.students.findByPhone(gymId, phone);
  }

  updateStudent(gymId: string, id: string, input: Partial<StudentInput>): Promise<Student> {
    return this.students.update(gymId, id, input);
  }

  updateStatus(gymId: string, id: string, status: StudentStatus): Promise<void> {
    return this.students.updateStatus(gymId, id, status);
  }

  deleteStudent(gymId: string, id: string): Promise<void> {
    return this.students.delete(gymId, id);
  }

  enroll(gymId: string, studentId: string, planId: string): Promise<StudentSubscription> {
    return this.students.enroll(gymId, studentId, planId);
  }

  addGoal(gymId: string, studentId: string, description: string, targetDate?: Date): Promise<StudentGoal> {
    return this.students.addGoal(gymId, studentId, description, targetDate);
  }

  markGoalAchieved(gymId: string, goalId: string, achieved: boolean): Promise<void> {
    return this.students.markGoalAchieved(gymId, goalId, achieved);
  }

  addNote(gymId: string, studentId: string, content: string): Promise<StudentNote> {
    return this.students.addNote(gymId, studentId, content);
  }

  getActiveCount(gymId: string): Promise<number> {
    return this.students.countByStatus(gymId, "ACTIVE");
  }

  getNewEnrollmentsSince(gymId: string, since: Date): Promise<number> {
    return this.students.countEnrolledSince(gymId, since);
  }

  findAllEnrolledBetween(from: Date, to: Date): Promise<Student[]> {
    return this.students.findAllEnrolledBetween(from, to);
  }
}

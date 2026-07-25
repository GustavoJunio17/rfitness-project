import { StudentsService } from "./students.service";
import type { StudentRepository } from "../../domain/repositories/student.repository";
import type { RealtimeService } from "../../../../shared/realtime/realtime.service";
import type { EventEmitter2 } from "@nestjs/event-emitter";

describe("StudentsService", () => {
  let students: jest.Mocked<StudentRepository>;
  let realtimeService: jest.Mocked<RealtimeService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let service: StudentsService;

  beforeEach(() => {
    students = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
      enroll: jest.fn(),
      addGoal: jest.fn(),
      markGoalAchieved: jest.fn(),
      addNote: jest.fn(),
      countByStatus: jest.fn(),
      countEnrolledSince: jest.fn(),
      findAllEnrolledBetween: jest.fn(),
    };
    realtimeService = { emitToGym: jest.fn() } as unknown as jest.Mocked<RealtimeService>;
    eventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
    service = new StudentsService(students, realtimeService, eventEmitter);
  });

  it("creates a student and emits a realtime signal", async () => {
    students.create.mockResolvedValue({
      id: "student-1",
      gymId: "gym-1",
      name: "João",
      cpf: null,
      phone: null,
      whatsapp: null,
      email: null,
      address: null,
      trainerName: null,
      status: "ACTIVE",
      enrollmentDate: new Date(),
      notes: null,
    });

    const student = await service.createStudent("gym-1", { name: "João" });

    expect(student.id).toBe("student-1");
    expect(realtimeService.emitToGym).toHaveBeenCalledWith("gym-1", "student.created", { studentId: "student-1" });
  });

  it("does not let a realtime emission failure surface as an error", async () => {
    students.create.mockResolvedValue({
      id: "student-1",
      gymId: "gym-1",
      name: "João",
      cpf: null,
      phone: null,
      whatsapp: null,
      email: null,
      address: null,
      trainerName: null,
      status: "ACTIVE",
      enrollmentDate: new Date(),
      notes: null,
    });
    realtimeService.emitToGym.mockImplementation(() => {
      throw new Error("socket down");
    });

    await expect(service.createStudent("gym-1", { name: "João" })).resolves.toMatchObject({ id: "student-1" });
  });

  it("delegates enrollment to the repository", async () => {
    students.enroll.mockResolvedValue({
      id: "sub-1",
      planId: "plan-1",
      planName: "Mensal",
      startDate: new Date(),
      dueDate: new Date(),
      cancelledAt: null,
    });

    const subscription = await service.enroll("gym-1", "student-1", "plan-1");

    expect(students.enroll).toHaveBeenCalledWith("gym-1", "student-1", "plan-1");
    expect(subscription.planName).toBe("Mensal");
  });

  it("computes active/new counts via the repository", async () => {
    students.countByStatus.mockResolvedValue(12);
    students.countEnrolledSince.mockResolvedValue(3);

    await expect(service.getActiveCount("gym-1")).resolves.toBe(12);
    expect(students.countByStatus).toHaveBeenCalledWith("gym-1", "ACTIVE");

    const since = new Date();
    await expect(service.getNewEnrollmentsSince("gym-1", since)).resolves.toBe(3);
    expect(students.countEnrolledSince).toHaveBeenCalledWith("gym-1", since);
  });
});

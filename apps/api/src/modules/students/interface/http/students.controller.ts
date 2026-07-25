import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { StudentsService } from "../../application/services/students.service";
import { CreateStudentDto, UpdateStudentDto } from "../../application/dto/student.dto";
import { EnrollStudentDto } from "../../application/dto/enroll-student.dto";
import { CreateGoalDto, CreateNoteDto, UpdateGoalDto } from "../../application/dto/goal-note.dto";
import { UpdateStudentStatusDto } from "../../application/dto/update-status.dto";
import type { StudentStatus } from "../../domain/repositories/student.repository";

@ApiBearerAuth()
@ApiTags("students")
@Controller("students")
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("search") search?: string,
    @Query("status") status?: StudentStatus,
  ) {
    return this.studentsService.listStudents(user.gymId, { search, status });
  }

  @Roles("ADMIN", "RECEPTION")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStudentDto) {
    return this.studentsService.createStudent(user.gymId, dto);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.studentsService.getStudent(user.gymId, id);
  }

  @Roles("ADMIN", "RECEPTION")
  @Put(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.updateStudent(user.gymId, id, dto);
  }

  @Roles("ADMIN", "RECEPTION")
  @Patch(":id/status")
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateStudentStatusDto,
  ) {
    return this.studentsService.updateStatus(user.gymId, id, dto.status);
  }

  @Roles("ADMIN", "RECEPTION")
  @Delete(":id")
  delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.studentsService.deleteStudent(user.gymId, id);
  }

  @Roles("ADMIN", "RECEPTION")
  @Post(":id/enroll")
  enroll(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: EnrollStudentDto) {
    return this.studentsService.enroll(user.gymId, id, dto.planId);
  }

  @Roles("ADMIN", "RECEPTION", "TRAINER")
  @Post(":id/goals")
  addGoal(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CreateGoalDto) {
    return this.studentsService.addGoal(
      user.gymId,
      id,
      dto.description,
      dto.targetDate ? new Date(dto.targetDate) : undefined,
    );
  }

  @Roles("ADMIN", "RECEPTION", "TRAINER")
  @Patch("goals/:goalId")
  updateGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("goalId") goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.studentsService.markGoalAchieved(user.gymId, goalId, dto.achieved);
  }

  @Roles("ADMIN", "RECEPTION", "TRAINER")
  @Post(":id/notes")
  addNote(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CreateNoteDto) {
    return this.studentsService.addNote(user.gymId, id, dto.content);
  }
}

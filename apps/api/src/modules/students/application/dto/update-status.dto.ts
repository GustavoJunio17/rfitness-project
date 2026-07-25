import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

const STUDENT_STATUSES = ["ACTIVE", "OVERDUE", "SUSPENDED", "CANCELLED"] as const;

export class UpdateStudentStatusDto {
  @ApiProperty({ enum: STUDENT_STATUSES })
  @IsIn(STUDENT_STATUSES)
  status!: (typeof STUDENT_STATUSES)[number];
}

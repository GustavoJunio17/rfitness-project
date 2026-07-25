import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class EnrollStudentDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;
}

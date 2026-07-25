import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateGoalDto {
  @ApiProperty({ example: "Perder 5kg até dezembro" })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class UpdateGoalDto {
  @ApiProperty()
  @IsBoolean()
  achieved!: boolean;
}

export class CreateNoteDto {
  @ApiProperty({ example: "Aluno relatou dor no joelho direito." })
  @IsString()
  @MinLength(1)
  content!: string;
}

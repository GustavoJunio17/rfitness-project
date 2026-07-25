import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreatePlanDto {
  @ApiProperty({ example: "Mensal" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 129.9 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

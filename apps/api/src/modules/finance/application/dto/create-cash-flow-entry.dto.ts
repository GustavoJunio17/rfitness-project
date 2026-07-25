import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateCashFlowEntryDto {
  @ApiProperty({ example: "Aluguel do espaço" })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: -1500, description: "Positivo = entrada, negativo = saída" })
  @IsNumber()
  amount!: number;

  @ApiProperty({ example: "aluguel" })
  @IsString()
  @IsNotEmpty()
  category!: string;
}

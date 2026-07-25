import { ApiProperty } from "@nestjs/swagger";
import { StockMovementType } from "@rfitness/database";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from "class-validator";

export class RegisterStockMovementDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @ApiProperty({
    description:
      "Para IN/OUT/SALE/LOSS/EXPIRATION: quantidade positiva a somar/subtrair. " +
      "Para EXCHANGE: variação líquida (pode ser negativa). " +
      "Para INVENTORY_ADJUSTMENT: a contagem final (total) do estoque, não o delta.",
    example: 10,
  })
  @IsInt()
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { PaymentMethodType } from "@rfitness/database";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class SaleItemDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateSaleDto {
  @ApiProperty({ required: false, description: "ID do aluno vinculado à venda (opcional)" })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  paymentMethod!: PaymentMethodType;

  @ApiProperty({ required: false, example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];
}

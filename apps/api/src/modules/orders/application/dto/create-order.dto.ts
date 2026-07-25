import { ApiProperty } from "@nestjs/swagger";
import { DeliveryType, PaymentMethodType } from "@rfitness/database";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";

export class OrderItemDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiProperty({ example: "João da Silva" })
  @IsString()
  @MinLength(1)
  customerName!: string;

  @ApiProperty({ example: "5511999999999" })
  @IsString()
  @MinLength(1)
  customerPhone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ enum: DeliveryType })
  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;

  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  paymentMethod!: PaymentMethodType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

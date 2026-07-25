import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus } from "@rfitness/database";
import { IsEnum } from "class-validator";

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

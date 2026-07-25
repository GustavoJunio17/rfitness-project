import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;

export class CreateProductVariantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ required: false, example: "Chocolate" })
  @IsOptional()
  @IsString()
  flavor?: string;

  @ApiProperty({ required: false, example: "900g" })
  @IsOptional()
  @IsString()
  weight?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batch?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ example: 45.9 })
  @IsNumber()
  @Min(0)
  costPrice!: number;

  @ApiProperty({ example: 89.9 })
  @IsNumber()
  @Min(0)
  salePrice!: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  minQuantity!: number;

  @ApiProperty({ required: false, example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxQuantity?: number;

  @ApiProperty({ required: false, example: 0, description: "Estoque inicial ao cadastrar o SKU" })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialQuantity?: number;
}

export class CreateProductDto {
  @ApiProperty({ example: "Whey Protein Growth" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ required: false, enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];

  @ApiProperty({ type: [CreateProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];
}

class ProductFieldsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ required: false, enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];
}

export class UpdateProductDto extends PartialType(ProductFieldsDto) {}

export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto) {}

export { PRODUCT_STATUSES };

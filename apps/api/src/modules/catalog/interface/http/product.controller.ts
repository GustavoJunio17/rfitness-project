import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { ProductService } from "../../application/services/product.service";
import { CreateProductDto, CreateProductVariantDto, UpdateProductDto, UpdateProductVariantDto } from "../../application/dto/product.dto";

@ApiBearerAuth()
@ApiTags("catalog")
@Controller("catalog")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get("products")
  listProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query("search") search?: string,
    @Query("categoryId") categoryId?: string,
    @Query("status") status?: "ACTIVE" | "INACTIVE" | "DISCONTINUED",
  ) {
    return this.productService.listProducts(user.gymId, { search, categoryId, status });
  }

  @Roles("ADMIN", "STOCKIST")
  @Post("products")
  createProduct(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    const { variants, ...productInput } = dto;
    return this.productService.createProduct(
      user.gymId,
      productInput,
      variants.map((variant) => ({
        ...variant,
        expiresAt: variant.expiresAt ? new Date(variant.expiresAt) : undefined,
      })),
    );
  }

  @Get("products/:id")
  getProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.productService.getProduct(user.gymId, id);
  }

  @Roles("ADMIN", "STOCKIST")
  @Put("products/:id")
  updateProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productService.updateProduct(user.gymId, id, dto);
  }

  @Roles("ADMIN", "STOCKIST")
  @Delete("products/:id")
  deleteProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.productService.deleteProduct(user.gymId, id);
  }

  @Roles("ADMIN", "STOCKIST")
  @Post("products/:id/variants")
  addVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.productService.addVariant(user.gymId, productId, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Roles("ADMIN", "STOCKIST")
  @Put("variants/:id")
  updateVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productService.updateVariant(user.gymId, variantId, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Get("variants/barcode/:code")
  findByBarcode(@CurrentUser() user: AuthenticatedUser, @Param("code") code: string) {
    return this.productService.findVariantByBarcode(user.gymId, code);
  }

  @Get("variants/:id/qrcode")
  getQrCode(@CurrentUser() user: AuthenticatedUser, @Param("id") variantId: string) {
    return this.productService.generateVariantQrCode(user.gymId, variantId);
  }

  @Roles("ADMIN", "STOCKIST")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @Post("variants/:id/photo")
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") variantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productService.uploadVariantPhoto(user.gymId, variantId, file);
  }
}

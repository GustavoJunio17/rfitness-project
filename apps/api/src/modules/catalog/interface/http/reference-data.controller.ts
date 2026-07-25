import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { ReferenceDataService } from "../../application/services/reference-data.service";
import { CreateSupplierDto, NameDto } from "../../application/dto/reference-data.dto";

@ApiBearerAuth()
@ApiTags("catalog")
@Controller("catalog")
export class ReferenceDataController {
  constructor(private readonly service: ReferenceDataService) {}

  @Get("categories")
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listCategories(user.gymId);
  }

  @Roles("ADMIN", "STOCKIST")
  @Post("categories")
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: NameDto) {
    return this.service.createCategory(user.gymId, dto.name);
  }

  @Roles("ADMIN", "STOCKIST")
  @Put("categories/:id")
  updateCategory(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: NameDto) {
    return this.service.updateCategory(user.gymId, id, dto.name);
  }

  @Roles("ADMIN", "STOCKIST")
  @Delete("categories/:id")
  deleteCategory(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.deleteCategory(user.gymId, id);
  }

  @Get("brands")
  listBrands(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listBrands(user.gymId);
  }

  @Roles("ADMIN", "STOCKIST")
  @Post("brands")
  createBrand(@CurrentUser() user: AuthenticatedUser, @Body() dto: NameDto) {
    return this.service.createBrand(user.gymId, dto.name);
  }

  @Roles("ADMIN", "STOCKIST")
  @Put("brands/:id")
  updateBrand(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: NameDto) {
    return this.service.updateBrand(user.gymId, id, dto.name);
  }

  @Roles("ADMIN", "STOCKIST")
  @Delete("brands/:id")
  deleteBrand(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.deleteBrand(user.gymId, id);
  }

  @Get("suppliers")
  listSuppliers(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listSuppliers(user.gymId);
  }

  @Roles("ADMIN", "STOCKIST")
  @Post("suppliers")
  createSupplier(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierDto) {
    return this.service.createSupplier(user.gymId, dto);
  }

  @Roles("ADMIN", "STOCKIST")
  @Put("suppliers/:id")
  updateSupplier(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CreateSupplierDto) {
    return this.service.updateSupplier(user.gymId, id, dto);
  }

  @Roles("ADMIN", "STOCKIST")
  @Delete("suppliers/:id")
  deleteSupplier(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.deleteSupplier(user.gymId, id);
  }
}

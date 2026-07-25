import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { SalesService } from "../../application/services/sales.service";
import { CreateSaleDto } from "../../application/dto/create-sale.dto";

@ApiBearerAuth()
@ApiTags("sales")
@Controller("sales")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Roles("ADMIN", "RECEPTION")
  @Post()
  createSale(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSaleDto) {
    return this.salesService.createSale(user.gymId, user.sub, dto);
  }

  @Get()
  listSales(
    @CurrentUser() user: AuthenticatedUser,
    @Query("employeeId") employeeId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.salesService.listSales(user.gymId, {
      employeeId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get(":id")
  getSale(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.getSale(user.gymId, id);
  }
}

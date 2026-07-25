import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { StockMovementType } from "@rfitness/database";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { InventoryService } from "../../application/services/inventory.service";
import { RegisterStockMovementDto } from "../../application/dto/register-stock-movement.dto";

@ApiBearerAuth()
@ApiTags("inventory")
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles("ADMIN", "STOCKIST")
  @Post("movements")
  registerMovement(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterStockMovementDto) {
    return this.inventoryService.registerMovement(user.gymId, dto, user.sub);
  }

  @Get("movements")
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query("variantId") variantId?: string,
    @Query("type") type?: StockMovementType,
  ) {
    return this.inventoryService.listMovements(user.gymId, { variantId, type });
  }

  @Get("alerts")
  listAlerts(@CurrentUser() user: AuthenticatedUser, @Query("resolved") resolved?: string) {
    const resolvedFilter = resolved === undefined ? undefined : resolved === "true";
    return this.inventoryService.listAlerts(user.gymId, resolvedFilter);
  }

  @Roles("ADMIN", "STOCKIST")
  @Patch("alerts/:id/resolve")
  resolveAlert(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.inventoryService.resolveAlert(user.gymId, id);
  }
}

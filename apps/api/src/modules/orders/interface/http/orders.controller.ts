import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { OrderStatus } from "@rfitness/database";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { OrdersService } from "../../application/services/orders.service";
import { CreateOrderDto } from "../../application/dto/create-order.dto";
import { UpdateOrderStatusDto } from "../../application/dto/update-order-status.dto";

@ApiBearerAuth()
@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles("ADMIN", "RECEPTION")
  @Post()
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.gymId, dto);
  }

  @Get()
  listOrders(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: OrderStatus) {
    return this.ordersService.listOrders(user.gymId, { status });
  }

  // Registered before ":id" — a literal "open-count" segment must not be
  // swallowed by the ":id" param route below.
  @Get("open-count")
  getOpenCount(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getOpenCount(user.gymId);
  }

  @Get(":id")
  getOrder(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.ordersService.getOrder(user.gymId, id);
  }

  @Roles("ADMIN", "RECEPTION", "STOCKIST")
  @Patch(":id/status")
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(user.gymId, id, dto.status, user.sub);
  }
}

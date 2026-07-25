import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { FinanceAnalyticsService } from "../../application/services/finance-analytics.service";
import { CashFlowService } from "../../application/services/cash-flow.service";
import { CreateCashFlowEntryDto } from "../../application/dto/create-cash-flow-entry.dto";

// Lucro/custo são dados sensíveis — todo o módulo financeiro fica restrito a
// ADMIN/FINANCE, diferente dos módulos anteriores (catalog/inventory/sales) que
// tinham leitura aberta a qualquer usuário autenticado.
@ApiBearerAuth()
@ApiTags("finance")
@Roles("ADMIN", "FINANCE")
@Controller("finance")
export class FinanceController {
  constructor(
    private readonly analytics: FinanceAnalyticsService,
    private readonly cashFlow: CashFlowService,
  ) {}

  @Get("summary")
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.getSummary(user.gymId);
  }

  @Get("revenue-series")
  getRevenueSeries(@CurrentUser() user: AuthenticatedUser, @Query("days") days?: string) {
    return this.analytics.getRevenueSeries(user.gymId, days ? Number(days) : 30);
  }

  @Get("top-products")
  getTopProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
    @Query("order") order?: "asc" | "desc",
  ) {
    return this.analytics.getTopProducts(user.gymId, limit ? Number(limit) : 5, order ?? "desc");
  }

  @Get("payment-methods-breakdown")
  getPaymentMethodsBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.getPaymentMethodBreakdown(user.gymId);
  }

  @Get("sales-heatmap")
  getSalesHeatmap(@CurrentUser() user: AuthenticatedUser, @Query("days") days?: string) {
    return this.analytics.getSalesHeatmap(user.gymId, days ? Number(days) : 30);
  }

  @Get("cash-flow")
  listCashFlow(@CurrentUser() user: AuthenticatedUser) {
    return this.cashFlow.listWithRunningBalance(user.gymId);
  }

  @Post("cash-flow")
  createCashFlowEntry(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCashFlowEntryDto) {
    return this.cashFlow.createManualEntry(user.gymId, dto);
  }
}

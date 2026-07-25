import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import { Roles } from "../../../../shared/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { PlansService } from "../../application/services/plans.service";
import { CreatePlanDto, UpdatePlanDto } from "../../application/dto/plan.dto";

@ApiBearerAuth()
@ApiTags("students")
@Controller("students/plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("activeOnly") activeOnly?: string) {
    return this.plansService.listPlans(user.gymId, activeOnly === "true");
  }

  @Roles("ADMIN", "RECEPTION")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlanDto) {
    return this.plansService.createPlan(user.gymId, dto);
  }

  @Roles("ADMIN", "RECEPTION")
  @Put(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.updatePlan(user.gymId, id, dto);
  }

  @Roles("ADMIN", "RECEPTION")
  @Delete(":id")
  delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.plansService.deletePlan(user.gymId, id);
  }
}

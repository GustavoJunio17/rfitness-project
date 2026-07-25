import { Inject, Injectable } from "@nestjs/common";
import { PLAN_REPOSITORY, Plan, PlanInput, PlanRepository } from "../../domain/repositories/plan.repository";

@Injectable()
export class PlansService {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  createPlan(gymId: string, input: PlanInput): Promise<Plan> {
    return this.plans.create(gymId, input);
  }

  listPlans(gymId: string, activeOnly?: boolean): Promise<Plan[]> {
    return this.plans.findAll(gymId, activeOnly);
  }

  updatePlan(gymId: string, id: string, input: Partial<PlanInput>): Promise<Plan> {
    return this.plans.update(gymId, id, input);
  }

  deletePlan(gymId: string, id: string): Promise<void> {
    return this.plans.delete(gymId, id);
  }
}

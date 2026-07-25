export const PLAN_REPOSITORY = Symbol("PLAN_REPOSITORY");

export interface Plan {
  id: string;
  gymId: string;
  name: string;
  description: string | null;
  price: string;
  durationDays: number;
  isActive: boolean;
}

export interface PlanInput {
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  isActive?: boolean;
}

export interface PlanRepository {
  create(gymId: string, input: PlanInput): Promise<Plan>;
  findAll(gymId: string, activeOnly?: boolean): Promise<Plan[]>;
  findById(gymId: string, id: string): Promise<Plan | null>;
  update(gymId: string, id: string, input: Partial<PlanInput>): Promise<Plan>;
  delete(gymId: string, id: string): Promise<void>;
}

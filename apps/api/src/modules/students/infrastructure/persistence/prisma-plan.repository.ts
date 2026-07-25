import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type { Plan, PlanInput, PlanRepository } from "../../domain/repositories/plan.repository";

@Injectable()
export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(gymId: string, input: PlanInput): Promise<Plan> {
    const plan = await this.prisma.plan.create({
      data: {
        gymId,
        name: input.name,
        description: input.description,
        price: input.price,
        durationDays: input.durationDays,
        isActive: input.isActive ?? true,
      },
    });
    return this.toDomain(plan);
  }

  async findAll(gymId: string, activeOnly?: boolean): Promise<Plan[]> {
    const plans = await this.prisma.plan.findMany({
      where: { gymId, isActive: activeOnly ? true : undefined },
      orderBy: { name: "asc" },
    });
    return plans.map((plan) => this.toDomain(plan));
  }

  async findById(gymId: string, id: string): Promise<Plan | null> {
    const plan = await this.prisma.plan.findFirst({ where: { id, gymId } });
    return plan ? this.toDomain(plan) : null;
  }

  async update(gymId: string, id: string, input: Partial<PlanInput>): Promise<Plan> {
    await this.assertExists(gymId, id);
    const plan = await this.prisma.plan.update({ where: { id }, data: input });
    return this.toDomain(plan);
  }

  async delete(gymId: string, id: string): Promise<void> {
    await this.assertExists(gymId, id);
    try {
      await this.prisma.plan.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Não é possível excluir um plano com matrículas vinculadas.");
      }
      throw error;
    }
  }

  private async assertExists(gymId: string, id: string): Promise<void> {
    const plan = await this.findById(gymId, id);
    if (!plan) throw new NotFoundException("Plano não encontrado.");
  }

  private toDomain(plan: {
    id: string;
    gymId: string;
    name: string;
    description: string | null;
    price: Prisma.Decimal;
    durationDays: number;
    isActive: boolean;
  }): Plan {
    return {
      id: plan.id,
      gymId: plan.gymId,
      name: plan.name,
      description: plan.description,
      price: plan.price.toString(),
      durationDays: plan.durationDays,
      isActive: plan.isActive,
    };
  }
}

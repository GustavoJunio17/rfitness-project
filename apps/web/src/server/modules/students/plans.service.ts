import { Prisma } from "@prisma/client";
import { conflictError, notFoundError, round2, toNumber, validationError } from "@rfitness/core";
import { prisma } from "../../db";

export interface PlanDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  isActive: boolean;
  activeSubscriptions: number;
}

export interface PlanWriteInput {
  name: string;
  description?: string | null;
  price: number;
  durationDays: number;
  isActive?: boolean;
}

export async function listPlans(gymId: string, activeOnly = false): Promise<PlanDto[]> {
  const plans = await prisma.plan.findMany({
    where: { gymId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { durationDays: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: toNumber(plan.price),
    durationDays: plan.durationDays,
    isActive: plan.isActive,
    activeSubscriptions: plan._count.subscriptions,
  }));
}

function assertPlanInput(input: Partial<PlanWriteInput>): void {
  if (input.price !== undefined && input.price < 0) {
    throw validationError("O preço do plano não pode ser negativo.");
  }
  if (input.durationDays !== undefined && input.durationDays <= 0) {
    throw validationError("A duração do plano deve ser maior que zero.");
  }
}

export async function createPlan(gymId: string, input: PlanWriteInput): Promise<PlanDto> {
  assertPlanInput(input);

  try {
    const plan = await prisma.plan.create({
      data: {
        gymId,
        name: input.name,
        description: input.description ?? null,
        price: new Prisma.Decimal(round2(input.price)),
        durationDays: input.durationDays,
        isActive: input.isActive ?? true,
      },
      include: { _count: { select: { subscriptions: true } } },
    });

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: toNumber(plan.price),
      durationDays: plan.durationDays,
      isActive: plan.isActive,
      activeSubscriptions: plan._count.subscriptions,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflictError("Já existe um plano com esse nome nesta academia.");
    }
    throw error;
  }
}

export async function updatePlan(
  gymId: string,
  id: string,
  input: Partial<PlanWriteInput>,
): Promise<PlanDto> {
  assertPlanInput(input);

  const existing = await prisma.plan.findFirst({ where: { id, gymId }, select: { id: true } });
  if (!existing) throw notFoundError("Plano não encontrado.");

  const plan = await prisma.plan.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: new Prisma.Decimal(round2(input.price)) } : {}),
      ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: { _count: { select: { subscriptions: true } } },
  });

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: toNumber(plan.price),
    durationDays: plan.durationDays,
    isActive: plan.isActive,
    activeSubscriptions: plan._count.subscriptions,
  };
}

/**
 * Plano com matrícula não é apagado — é desativado. Apagar quebraria o histórico
 * financeiro de quem já pagou por ele.
 */
export async function deletePlan(gymId: string, id: string): Promise<{ deactivated: boolean }> {
  const plan = await prisma.plan.findFirst({
    where: { id, gymId },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!plan) throw notFoundError("Plano não encontrado.");

  if (plan._count.subscriptions > 0) {
    await prisma.plan.update({ where: { id }, data: { isActive: false } });
    return { deactivated: true };
  }

  await prisma.plan.delete({ where: { id } });
  return { deactivated: false };
}

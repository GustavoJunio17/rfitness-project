import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  CashFlowEntry,
  CashFlowRepository,
  CreateCashFlowEntryInput,
} from "../../domain/repositories/cash-flow.repository";

@Injectable()
export class PrismaCashFlowRepository implements CashFlowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCashFlowEntryInput): Promise<CashFlowEntry> {
    const entry = await this.prisma.cashFlowEntry.create({
      data: {
        gymId: input.gymId,
        description: input.description,
        amount: input.amount,
        category: input.category,
      },
    });
    return { ...entry, amount: entry.amount.toString() };
  }

  async findMany(gymId: string, limit: number): Promise<CashFlowEntry[]> {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: { gymId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    return entries.map((entry) => ({ ...entry, amount: entry.amount.toString() }));
  }
}

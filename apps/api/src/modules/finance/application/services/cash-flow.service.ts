import { Inject, Injectable } from "@nestjs/common";
import {
  CASH_FLOW_REPOSITORY,
  CashFlowEntry,
  CashFlowRepository,
} from "../../domain/repositories/cash-flow.repository";
import { CreateCashFlowEntryDto } from "../dto/create-cash-flow-entry.dto";

export interface CashFlowEntryWithBalance extends CashFlowEntry {
  runningBalance: string;
}

const DEFAULT_LIST_LIMIT = 200;

@Injectable()
export class CashFlowService {
  constructor(@Inject(CASH_FLOW_REPOSITORY) private readonly cashFlow: CashFlowRepository) {}

  createManualEntry(gymId: string, dto: CreateCashFlowEntryDto): Promise<CashFlowEntry> {
    return this.cashFlow.create({
      gymId,
      description: dto.description,
      amount: dto.amount,
      category: dto.category,
    });
  }

  /** Called by SalesService right after a sale commits — best-effort, not part of the sale's transaction. */
  registerSaleRevenue(gymId: string, saleId: string, totalAmount: number): Promise<CashFlowEntry> {
    return this.cashFlow.create({
      gymId,
      description: `Venda ${saleId}`,
      amount: totalAmount,
      category: "venda",
    });
  }

  async listWithRunningBalance(gymId: string): Promise<CashFlowEntryWithBalance[]> {
    const entries = await this.cashFlow.findMany(gymId, DEFAULT_LIST_LIMIT);
    // Entries come back newest-first; accumulate oldest-first then reverse for display.
    let balance = 0;
    const chronological = [...entries].reverse();
    const withBalance = chronological.map((entry) => {
      balance += Number(entry.amount);
      return { ...entry, runningBalance: balance.toFixed(2) };
    });
    return withBalance.reverse();
  }
}

export const CASH_FLOW_REPOSITORY = Symbol("CASH_FLOW_REPOSITORY");

export interface CashFlowEntry {
  id: string;
  gymId: string;
  description: string;
  amount: string;
  category: string;
  occurredAt: Date;
}

export interface CreateCashFlowEntryInput {
  gymId: string;
  description: string;
  amount: number;
  category: string;
}

export interface CashFlowRepository {
  create(input: CreateCashFlowEntryInput): Promise<CashFlowEntry>;
  findMany(gymId: string, limit: number): Promise<CashFlowEntry[]>;
}

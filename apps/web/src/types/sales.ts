export type PaymentMethodType = "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "PIX" | "BOLETO";

export interface SaleItem {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: string;
  unitCost: string;
}

export interface Sale {
  id: string;
  gymId: string;
  studentId: string | null;
  employeeId: string;
  paymentMethod: PaymentMethodType;
  discount: string;
  totalAmount: string;
  totalProfit: string;
  createdAt: string;
  items: SaleItem[];
}

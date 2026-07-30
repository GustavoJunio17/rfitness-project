"use client";

import { FormEvent, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalesHeatmap } from "@/components/finance/sales-heatmap";
import {
  useCashFlow,
  useCreateCashFlowEntry,
  usePaymentMethodBreakdown,
  useSalesHeatmap,
  useTopProducts,
} from "@/hooks/use-finance";
import { ApiError } from "@/lib/api-client";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
};

const CHART_COLORS = ["#E11D2E", "#111111", "#6b7280", "#f59e0b", "#3b82f6"];

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinanceiroPage() {
  const { data: topProducts } = useTopProducts(5, "desc");
  const { data: leastProducts } = useTopProducts(5, "asc");
  const { data: paymentBreakdown } = usePaymentMethodBreakdown();
  const { data: heatmapCells } = useSalesHeatmap(30);
  const { data: cashFlow, error: cashFlowError } = useCashFlow();
  const createEntry = useCreateCashFlowEntry();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");

  if (cashFlowError instanceof ApiError && cashFlowError.status === 403) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        Você não tem permissão para ver o financeiro. Fale com um administrador.
      </div>
    );
  }

  async function handleCreateEntry(event: FormEvent) {
    event.preventDefault();
    await createEntry.mutateAsync({ description, amount: Number(amount), category });
    setDescription("");
    setAmount("");
    setCategory("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Produtos mais/menos vendidos, formas de pagamento e fluxo de caixa.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mais vendidos (90 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts ?? []} layout="vertical" margin={{ left: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="productName" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="quantitySold" fill="#E11D2E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Menos vendidos (90 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leastProducts ?? []} layout="vertical" margin={{ left: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="productName" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="quantitySold" fill="#111111" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Formas de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentBreakdown ?? []}
                  dataKey="revenue"
                  nameKey="paymentMethod"
                  outerRadius={90}
                  label={(entry) => PAYMENT_METHOD_LABELS[entry.paymentMethod] ?? entry.paymentMethod}
                >
                  {(paymentBreakdown ?? []).map((entry, index) => (
                    <Cell key={entry.paymentMethod} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => currency(value)} />
                <Legend formatter={(value) => PAYMENT_METHOD_LABELS[value] ?? value} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horários de venda (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesHeatmap cells={heatmapCells ?? []} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo de caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cashFlow ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma movimentação registrada.
                    </TableCell>
                  </TableRow>
                )}
                {cashFlow?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.occurredAt).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell className={Number(entry.amount) < 0 ? "text-brand-red" : ""}>
                      {currency(Number(entry.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nova entrada manual</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateEntry} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cf-description">Descrição</Label>
                <Input
                  id="cf-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-amount">Valor (negativo = saída)</Label>
                <Input
                  id="cf-amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-category">Categoria</Label>
                <Input id="cf-category" value={category} onChange={(e) => setCategory(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={createEntry.isPending}>
                {createEntry.isPending ? "Salvando..." : "Lançar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

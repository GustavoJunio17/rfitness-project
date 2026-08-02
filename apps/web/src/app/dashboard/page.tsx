"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonChart, SkeletonStatCards } from "@/components/ui/skeleton";
import { useFinanceSummary, useRevenueSeries } from "@/hooks/use-finance";
import { useOpenOrdersCount } from "@/hooks/use-orders";
import { ApiError } from "@/lib/api-client";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FUTURE_PHASE_CARDS = [
  { label: "Mensalidades vencendo", phase: "Fase 8" },
  { label: "Mensalidades vencidas", phase: "Fase 8" },
];

export default function DashboardPage() {
  const { data: summary, error: summaryError, isPending: isSummaryPending } = useFinanceSummary();
  const { data: series, isPending: isSeriesPending } = useRevenueSeries(30);
  const { data: openOrdersCount } = useOpenOrdersCount();

  if (summaryError instanceof ApiError && summaryError.status === 403) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        Você não tem permissão para ver os indicadores financeiros. Fale com um administrador.
      </div>
    );
  }

  const cards = summary
    ? [
        { label: "Faturamento hoje", value: currency(summary.today.revenue) },
        { label: "Lucro hoje", value: currency(summary.today.profit) },
        { label: "Faturamento no mês", value: currency(summary.month.revenue) },
        { label: "Ticket médio (mês)", value: currency(summary.averageTicket) },
        { label: "Clientes ativos", value: String(summary.students.active) },
        { label: "Novos alunos (mês)", value: String(summary.students.newThisMonth) },
        { label: "Pedidos pendentes", value: String(openOrdersCount ?? 0) },
        { label: "Valor do estoque", value: currency(summary.stock.retailValue) },
        { label: "Valor investido em estoque", value: currency(summary.stock.investedValue) },
        { label: "Produtos com estoque baixo", value: String(summary.stock.lowStockCount) },
        { label: "Produtos em falta", value: String(summary.stock.outOfStockCount) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores em tempo real de vendas e estoque — atualizam automaticamente a cada venda ou alerta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={isSummaryPending}>
        {/* Mesma contagem de cartões da versão carregada: a grade não salta. */}
        {isSummaryPending && <SkeletonStatCards count={11} />}
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle>{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
        {FUTURE_PHASE_CARDS.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle>{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground">Disponível na {card.phase}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receita — últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent className="h-72" aria-busy={isSeriesPending}>
          {isSeriesPending ? (
            <SkeletonChart />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series ?? []}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value) => value.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(value) => currency(Number(value))} />
              <Tooltip formatter={(value: number) => currency(value)} labelFormatter={(label) => `Dia ${label}`} />
              <Line type="monotone" dataKey="revenue" stroke="#E11D2E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  PackageX,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonChart, SkeletonStatCards } from "@/components/ui/skeleton";
import { useFinanceSummary, useRevenueSeries } from "@/hooks/use-finance";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Stat {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  /** Destaque para o que exige ação — não para o que só é grande. */
  alert?: boolean;
}

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;

  const content = (
    <Card
      className={cn(
        "h-full transition-colors",
        stat.alert && "border-amber-500/50 bg-amber-500/5",
        stat.href && "hover:border-brand-red/50",
      )}
    >
      <CardContent className="space-y-1 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className={cn("h-4 w-4", stat.alert && "text-amber-500")} aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wide">{stat.label}</span>
        </div>
        <p className={cn("text-2xl font-bold", stat.alert && "text-amber-500")}>{stat.value}</p>
        {stat.hint && <p className="text-xs text-muted-foreground">{stat.hint}</p>}
      </CardContent>
    </Card>
  );

  return stat.href ? <Link href={stat.href}>{content}</Link> : content;
}

function StatGroup({ title, stats }: { title: string; stats: Stat[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

/**
 * Convite para os primeiros passos.
 *
 * Uma academia recém-criada só tem zeros, e uma parede deles não diz se o
 * sistema está quebrado ou se ainda não houve movimento. Aqui a resposta é
 * explícita, com o caminho para começar.
 */
function EmptyState() {
  const steps = [
    { href: "/dashboard/estoque", label: "Cadastrar produtos", description: "Monte o catálogo e o estoque inicial." },
    { href: "/dashboard/alunos", label: "Cadastrar alunos", description: "Crie os planos e matricule os primeiros." },
    { href: "/dashboard/vendas", label: "Registrar uma venda", description: "O balcão que alimenta estes indicadores." },
  ];

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 p-8 text-center">
        <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="font-semibold">Ainda não há movimento nesta academia</h2>
          <p className="text-sm text-muted-foreground">
            Os indicadores aparecem sozinhos assim que houver vendas, alunos e estoque.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {steps.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="rounded-md border border-border p-3 text-left transition-colors hover:border-brand-red/50 hover:bg-muted/40"
            >
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardOverview() {
  const { data: summary, error: summaryError, isPending: isSummaryPending } = useFinanceSummary();
  const { data: series, isPending: isSeriesPending } = useRevenueSeries(30);

  if (summaryError instanceof ApiError && summaryError.status === 403) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        Você não tem permissão para ver os indicadores financeiros. Fale com um administrador.
      </div>
    );
  }

  // Uma academia sem nenhum dado não precisa de treze zeros na tela.
  const isEmpty =
    summary !== undefined &&
    summary.totalRevenue === 0 &&
    summary.students.active === 0 &&
    summary.stock.retailValue === 0 &&
    summary.openOrders === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores de vendas e estoque — atualizam sozinhos a cada venda ou alerta.
        </p>
      </div>

      {isSummaryPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
          <SkeletonStatCards count={8} />
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : summary ? (
        <>
          <StatGroup
            title="Hoje"
            stats={[
              { label: "Faturamento", value: currency(summary.today.revenue), icon: Wallet },
              { label: "Lucro", value: currency(summary.today.profit), icon: TrendingUp },
              {
                label: "Vendas",
                value: String(summary.today.salesCount),
                icon: Receipt,
                href: "/dashboard/vendas",
              },
              {
                label: "Pedidos pendentes",
                value: String(summary.openOrders),
                icon: ClipboardList,
                href: "/dashboard/pedidos",
                alert: summary.openOrders > 0,
              },
            ]}
          />

          <StatGroup
            title="Mês"
            stats={[
              { label: "Faturamento", value: currency(summary.month.revenue), icon: Wallet },
              { label: "Lucro", value: currency(summary.month.profit), icon: TrendingUp },
              {
                label: "Ticket médio",
                value: currency(summary.averageTicket),
                icon: Receipt,
              },
              {
                label: "Projeção do mês",
                value: currency(summary.projectedMonthRevenue),
                hint: "No ritmo atual",
                icon: TrendingUp,
              },
            ]}
          />

          <StatGroup
            title="Alunos e estoque"
            stats={[
              {
                label: "Alunos ativos",
                value: String(summary.students.active),
                hint: `${summary.students.newThisMonth} novo(s) no mês`,
                icon: Users,
                href: "/dashboard/alunos",
              },
              {
                label: "Valor do estoque",
                value: currency(summary.stock.retailValue),
                hint: `${currency(summary.stock.investedValue)} investidos`,
                icon: Boxes,
                href: "/dashboard/estoque",
              },
              {
                label: "Estoque baixo",
                value: String(summary.stock.lowStockCount),
                icon: AlertTriangle,
                href: "/dashboard/estoque",
                alert: summary.stock.lowStockCount > 0,
              },
              {
                label: "Em falta",
                value: String(summary.stock.outOfStockCount),
                icon: PackageX,
                href: "/dashboard/estoque",
                alert: summary.stock.outOfStockCount > 0,
              },
            ]}
          />
        </>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Receita — últimos 30 dias
          </h2>
          <div className="h-64" aria-busy={isSeriesPending}>
            {isSeriesPending ? (
              <SkeletonChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series ?? []}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={70}
                    tickFormatter={(value) => currency(Number(value))}
                  />
                  <Tooltip
                    formatter={(value: number) => currency(value)}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#E11D2E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

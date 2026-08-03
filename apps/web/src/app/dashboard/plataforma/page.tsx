"use client";

import { useState } from "react";
import { Building2, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonStatCards } from "@/components/ui/skeleton";
import { AccountsPanel } from "@/components/platform/accounts-panel";
import { GymsPanel } from "@/components/platform/gyms-panel";
import { usePlatformOverview } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

type Tab = "accounts" | "gyms";

/** Console da RFitness: contas de gestor e academias, com CRUD dos dois. */
export default function PlataformaPage() {
  const [tab, setTab] = useState<Tab>("accounts");
  const { data: overview, isLoading } = usePlatformOverview();

  const tabs: { id: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: "accounts", label: "Contas de gestor", icon: Users, badge: overview?.accounts.pending },
    { id: "gyms", label: "Academias", icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-brand-red" aria-hidden />
          Plataforma
        </h1>
        <p className="text-sm text-muted-foreground">
          Administração da RFitness: contas de gestor e academias da rede.
        </p>
      </div>

      {isLoading ? (
        <SkeletonStatCards count={4} />
      ) : (
        overview && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Contas pendentes</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.accounts.pending}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Gestores ativos</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {overview.accounts.active}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  de {overview.accounts.total}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Academias ativas</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {overview.gyms.active}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  de {overview.gyms.total}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Contas bloqueadas</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.accounts.blocked}</CardContent>
            </Card>
          </div>
        )
      )}

      <div className="flex gap-1 border-b border-border" role="tablist">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-brand-red text-brand-red"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
              {item.badge ? (
                <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "accounts" ? <AccountsPanel /> : <GymsPanel />}
    </div>
  );
}

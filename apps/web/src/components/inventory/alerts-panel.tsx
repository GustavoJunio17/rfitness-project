"use client";

import { AlertTriangle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResolveAlert, useStockAlerts } from "@/hooks/use-inventory";
import type { StockAlertType } from "@/types/catalog";

const ALERT_LABELS: Record<StockAlertType, string> = {
  LOW_STOCK: "Estoque baixo",
  EXPIRING_SOON: "Vencendo em breve",
  EXPIRED: "Vencido",
  STALE: "Produto parado",
};

export function AlertsPanel() {
  const { data: alerts, isLoading } = useStockAlerts(false);
  const resolveAlert = useResolveAlert();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-brand-red" />
          Alertas de estoque
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando alertas...</p>}
        {alerts?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta em aberto.</p>}
        {alerts?.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
          >
            <div>
              <Badge variant={alert.type === "LOW_STOCK" ? "destructive" : "warning"}>
                {ALERT_LABELS[alert.type]}
              </Badge>
              <p className="mt-1 text-sm">{alert.message}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resolveAlert.mutate(alert.id)}
              disabled={resolveAlert.isPending}
            >
              <Check className="mr-1 h-4 w-4" /> Resolver
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

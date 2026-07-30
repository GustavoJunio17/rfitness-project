"use client";

import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrder, useUpdateOrderStatus } from "@/hooks/use-orders";
import { ApiError } from "@/lib/api-client";
import type { OrderStatus } from "@/types/orders";
import { useState } from "react";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  SEPARATING: "Separando",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const STATUS_VARIANTS: Record<OrderStatus, "default" | "outline" | "destructive" | "warning"> = {
  PENDING: "outline",
  SEPARATING: "warning",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["SEPARATING", "CANCELLED"],
  SEPARATING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrderDetailDialog({
  orderId,
  onOpenChange,
}: {
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: order } = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const [error, setError] = useState<string | null>(null);

  if (!orderId) return null;

  async function handleTransition(status: OrderStatus) {
    setError(null);
    try {
      await updateStatus.mutateAsync({ orderId: orderId!, status });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível atualizar o status.");
    }
  }

  return (
    <Dialog open={Boolean(orderId)} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{order ? `Pedido #${order.orderNumber}` : "Carregando..."}</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      {order && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={STATUS_VARIANTS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
            <span>{order.customerName}</span>
            <span>{order.customerPhone}</span>
            <span>{order.deliveryType === "DELIVERY" ? "Entrega" : "Retirada"}</span>
          </div>

          {order.address && <p className="text-sm text-muted-foreground">Endereço: {order.address}</p>}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Itens</h3>
            {order.items.map((item) => (
              <div key={item.variantId} className="flex justify-between rounded-md border border-border p-2 text-sm">
                <span>
                  {item.sku} × {item.quantity}
                </span>
                <span>{currency(Number(item.unitPrice) * item.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{currency(Number(order.totalAmount))}</span>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Histórico de status</h3>
            {order.statusHistory.map((entry) => (
              <div key={`${entry.status}-${entry.changedAt}`} className="flex justify-between text-sm text-muted-foreground">
                <span>{STATUS_LABELS[entry.status]}</span>
                <span>{new Date(entry.changedAt).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </section>

          {error && <p className="text-sm text-brand-red">{error}</p>}

          {NEXT_STATUS[order.status].length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {NEXT_STATUS[order.status].map((status) => (
                <Button
                  key={status}
                  variant={status === "CANCELLED" ? "outline" : "default"}
                  disabled={updateStatus.isPending}
                  onClick={() => handleTransition(status)}
                >
                  {STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

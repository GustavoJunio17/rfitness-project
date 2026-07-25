"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrders } from "@/hooks/use-orders";
import { OrderFormDialog } from "@/components/orders/order-form-dialog";
import { OrderDetailDialog } from "@/components/orders/order-detail-dialog";
import type { OrderStatus } from "@/types/orders";

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

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PedidosPage() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useOrders(status || undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos criados manualmente ou pelo agente de IA no WhatsApp.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo pedido
        </Button>
      </div>

      <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")} className="max-w-xs">
        <option value="">Todos os status</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Entrega</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Carregando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && (orders ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum pedido encontrado.
              </TableCell>
            </TableRow>
          )}
          {orders?.map((order) => (
            <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrderId(order.id)}>
              <TableCell className="font-medium">#{order.orderNumber}</TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>{order.deliveryType === "DELIVERY" ? "Entrega" : "Retirada"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
              </TableCell>
              <TableCell>{currency(Number(order.totalAmount))}</TableCell>
              <TableCell>{new Date(order.createdAt).toLocaleString("pt-BR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <OrderFormDialog open={isFormOpen} onOpenChange={setFormOpen} />
      <OrderDetailDialog orderId={selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)} />
    </div>
  );
}

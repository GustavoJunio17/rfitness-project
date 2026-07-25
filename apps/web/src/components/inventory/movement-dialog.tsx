"use client";

import { FormEvent, useState } from "react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useRegisterMovement } from "@/hooks/use-inventory";
import type { StockMovementType } from "@/types/catalog";

const MOVEMENT_TYPES: { value: StockMovementType; label: string }[] = [
  { value: "IN", label: "Entrada" },
  { value: "OUT", label: "Saída" },
  { value: "SALE", label: "Venda" },
  { value: "EXCHANGE", label: "Troca" },
  { value: "LOSS", label: "Perda" },
  { value: "EXPIRATION", label: "Baixa por vencimento" },
  { value: "INVENTORY_ADJUSTMENT", label: "Ajuste de inventário (contagem)" },
];

interface MovementDialogProps {
  variant: { id: string; sku: string; currentQuantity: number } | null;
  onOpenChange: (open: boolean) => void;
}

export function MovementDialog({ variant, onOpenChange }: MovementDialogProps) {
  const [type, setType] = useState<StockMovementType>("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const registerMovement = useRegisterMovement();

  const isAdjustment = type === "INVENTORY_ADJUSTMENT";
  const isExchange = type === "EXCHANGE";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!variant) return;
    setError(null);
    try {
      await registerMovement.mutateAsync({
        variantId: variant.id,
        type,
        quantity: Number(quantity),
        reason: reason || undefined,
      });
      setQuantity("");
      setReason("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a movimentação.");
    }
  }

  return (
    <Dialog open={Boolean(variant)} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Registrar movimentação — {variant?.sku}</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Estoque atual: <span className="font-semibold text-foreground">{variant?.currentQuantity}</span>
        </p>
        <div className="space-y-2">
          <Label htmlFor="movement-type">Tipo</Label>
          <Select id="movement-type" value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>
            {MOVEMENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="movement-quantity">
            {isAdjustment ? "Nova contagem total" : isExchange ? "Variação (use negativo para saída)" : "Quantidade"}
          </Label>
          <Input
            id="movement-quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="movement-reason">Motivo (opcional)</Label>
          <Input id="movement-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={registerMovement.isPending}>
          {registerMovement.isPending ? "Registrando..." : "Registrar"}
        </Button>
      </form>
    </Dialog>
  );
}

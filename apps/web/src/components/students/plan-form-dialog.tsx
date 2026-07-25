"use client";

import { FormEvent, useState } from "react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePlan } from "@/hooks/use-students";

export function PlanFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createPlan = useCreatePlan();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createPlan.mutateAsync({ name, price: Number(price), durationDays: Number(durationDays) });
      setName("");
      setPrice("");
      setDurationDays("30");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o plano.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Novo plano</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="plan-name">Nome</Label>
          <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="plan-price">Preço (R$)</Label>
            <Input
              id="plan-price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-duration">Duração (dias)</Label>
            <Input
              id="plan-duration"
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={createPlan.isPending}>
          {createPlan.isPending ? "Salvando..." : "Criar plano"}
        </Button>
      </form>
    </Dialog>
  );
}

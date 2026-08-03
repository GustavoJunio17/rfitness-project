"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Confirmação de ação destrutiva.
 *
 * `confirmText` liga a trava de digitação, usada quando a ação leva dados de
 * terceiros junto (excluir uma academia apaga alunos, estoque e histórico). Um
 * "tem certeza?" com botão vermelho é fácil demais de aceitar no automático.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  confirmText,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = confirmText !== undefined && typed.trim() !== confirmText;

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      setTyped("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-brand-red/30 bg-brand-red/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden />
          <div className="space-y-1">{description}</div>
        </div>

        {confirmText !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              Digite <span className="font-mono font-semibold">{confirmText}</span> para confirmar
            </Label>
            <Input
              id="confirm-text"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || locked}
            className="bg-brand-red text-white hover:bg-brand-red/90"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

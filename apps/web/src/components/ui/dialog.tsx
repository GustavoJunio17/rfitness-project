"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Painel lateral direito. Cadastro, edição e detalhe abrem aqui.
 *
 * Era um diálogo centralizado, que cobria a lista de onde a ação partiu — ao
 * cadastrar um produto ou abrir um pedido, some justamente o contexto que se
 * estava consultando. Encostado na direita, a tabela continua à vista.
 *
 * A API não mudou (`DialogHeader`, `DialogTitle`, `DialogCloseButton`): a
 * mudança é do primitivo, então todas as telas passaram a se comportar igual
 * sem alteração ponto a ponto — e nenhuma ficou para trás.
 */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg animate-slide-in-right flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Grudado no topo: um formulário longo rola sem levar o título junto.
        "sticky -top-6 z-10 -mx-6 -mt-6 mb-4 flex items-center justify-between gap-3 border-b border-border bg-card px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("truncate text-lg font-semibold", className)} {...props} />;
}

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Fechar"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

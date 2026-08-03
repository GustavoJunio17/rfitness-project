"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSession, useSwitchGym } from "@/hooks/use-session";

/**
 * Seletor da academia ativa.
 *
 * Uma rede pode ter várias unidades, e o dashboard inteiro é escopado por uma
 * delas. Só aparece quando há mais de uma: com uma única academia o controle
 * seria um menu de um item só.
 */
export function GymSwitcher() {
  const router = useRouter();
  const { data: session } = useSession();
  const switchGym = useSwitchGym();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clique fora fecha: sem isso o menu ficaria aberto atrás do conteúdo depois
  // de o usuário desistir da troca.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const memberships = session?.memberships ?? [];
  if (memberships.length < 2) return null;

  const activeGymId = session?.gym?.id ?? null;

  async function handleSelect(gymId: string) {
    setOpen(false);
    if (gymId === activeGymId) return;
    await switchGym.mutateAsync(gymId);
    // `refresh` além do cache limpo: o shell do dashboard é Server Component e
    // lê a academia ativa no servidor.
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={switchGym.isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
      >
        {switchGym.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        <span className="max-w-[12rem] truncate">{session?.gym?.name ?? "Selecionar academia"}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
        >
          {memberships.map((membership) => (
            <li key={membership.gymId}>
              <button
                type="button"
                role="option"
                aria-selected={membership.gymId === activeGymId}
                onClick={() => handleSelect(membership.gymId)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                  membership.gymId === activeGymId && "font-medium text-brand-red",
                )}
              >
                <span className="truncate">{membership.gymName}</span>
                {membership.gymId === activeGymId && <Check className="h-4 w-4 shrink-0" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

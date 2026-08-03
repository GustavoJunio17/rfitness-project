"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, useSwitchGym } from "@/hooks/use-session";

/**
 * `bg-card`, não `bg-popover`: o tema não define a cor de popover, então a
 * classe não gerava regra nenhuma e o menu ficava transparente sobre o
 * conteúdo atrás dele.
 */
const MENU_CLASS =
  "absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-md border border-border bg-card shadow-lg";

/**
 * Seletor da academia ativa.
 *
 * O dashboard inteiro é escopado por uma unidade, então qual delas está em uso
 * precisa estar sempre visível — inclusive com uma só. Escondê-lo nesse caso
 * economizaria um clique e cobraria o preço de o gestor não ter onde confirmar
 * em que unidade acabou de lançar uma venda.
 */
export function GymSwitcher() {
  const { data: session } = useSession();
  const switchGym = useSwitchGym();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clique fora e Esc fecham: sem isso o menu ficaria aberto sobre o conteúdo
  // depois de o usuário desistir da troca.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const memberships = session?.memberships ?? [];
  if (memberships.length === 0) return null;

  const activeGymId = session?.gym?.id ?? null;
  const activeName = session?.gym?.name ?? "Selecionar academia";

  async function handleSelect(gymId: string) {
    setOpen(false);
    if (gymId === activeGymId) return;
    await switchGym.mutateAsync(gymId);

    // Recarga completa. `router.refresh()` revalidaria só a rota atual, e o
    // cache do App Router guardaria as outras telas ainda montadas para a
    // academia anterior — o gestor veria o nome de uma unidade e os números de
    // outra ao navegar.
    window.location.reload();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={switchGym.isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm transition-colors hover:bg-muted disabled:opacity-60"
      >
        {switchGym.isPending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-brand-red" aria-hidden />
        )}
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Academia</span>
          <span className="max-w-[11rem] truncate font-medium">{activeName}</span>
        </span>
        {memberships.length > 1 && (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open && (
        <div className={MENU_CLASS}>
          <p className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suas academias
          </p>

          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {memberships.map((membership) => {
              const isActive = membership.gymId === activeGymId;
              return (
                <li key={membership.gymId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(membership.gymId)}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      isActive && "bg-muted/60",
                    )}
                  >
                    <span className="min-w-0">
                      <span
                        className={cn("block truncate", isActive && "font-medium text-brand-red")}
                      >
                        {membership.gymName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {membership.roles.join(" · ") || "sem papel definido"}
                      </span>
                    </span>
                    {isActive && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Sem atalhos de criação ou gestão: quem cadastra academia e define
              quem a acessa é a administração da RFitness. Para o gestor esta
              lista é o conjunto fechado do que ele pode operar. */}
        </div>
      )}
    </div>
  );
}

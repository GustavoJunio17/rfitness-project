import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shell inteiro em skeleton. Cobre a janela em que o layout do dashboard ainda
 * está validando a sessão no servidor — antes disso nem a sidebar existe, então
 * um skeleton só do conteúdo deixaria a tela em branco.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen" aria-busy>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Skeleton className="h-6 w-28" />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-20" />
          </div>
        </header>

        <main className="flex-1 bg-muted/30 p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

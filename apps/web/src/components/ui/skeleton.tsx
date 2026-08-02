import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Bloco cinza pulsante. Base de todos os placeholders — a cor sai de `muted`,
 * então acompanha o tema claro/escuro sem variante própria.
 *
 * Todo skeleton é `aria-hidden`: quem usa leitor de tela ouve o `aria-busy` do
 * container, não uma sequência de caixas vazias.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

/**
 * Linhas de texto. A última sai mais curta porque parágrafo real raramente
 * termina na margem — sem isso o bloco parece uma tabela, não texto.
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Cartão de indicador: rótulo curto em cima, número grande embaixo. */
export function SkeletonStatCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-24" />
      </CardContent>
    </Card>
  );
}

export function SkeletonStatCards({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonStatCard key={index} />
      ))}
    </>
  );
}

/**
 * Corpo de tabela em carregamento. Recebe a mesma contagem de colunas do
 * cabeçalho real para as larguras não saltarem quando os dados chegam.
 */
export function SkeletonTableRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <TableCell key={columnIndex}>
              {/* Primeira coluna costuma ser o nome: mais larga que as demais. */}
              <Skeleton className={cn("h-4", columnIndex === 0 ? "w-40" : "w-20")} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Tabela inteira (cabeçalho incluso) para quando nem os títulos existem ainda. */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-busy>
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableHead key={index}>
                <Skeleton className="h-4 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <SkeletonTableRows rows={rows} columns={columns} />
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Gráfico: barras de alturas variadas sobre uma linha de base. Alturas fixas em
 * vez de aleatórias — `Math.random` aqui daria hidratação divergente entre
 * servidor e cliente.
 */
const BAR_HEIGHTS = ["40%", "65%", "50%", "80%", "35%", "70%", "55%", "90%", "45%", "60%", "75%", "50%"];

export function SkeletonChart({ className, bars = 12 }: { className?: string; bars?: number }) {
  return (
    <div className={cn("flex h-full w-full items-end gap-2 border-b border-l border-border p-2", className)} aria-hidden>
      {BAR_HEIGHTS.slice(0, bars).map((height, index) => (
        <Skeleton key={index} className="w-full flex-1" style={{ height }} />
      ))}
    </div>
  );
}

/** Lista vertical de itens clicáveis (conversas, notificações, alertas). */
export function SkeletonList({
  items = 4,
  className,
  withAvatar = false,
}: {
  items?: number;
  className?: string;
  withAvatar?: boolean;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-busy>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-md border border-border p-3">
          {withAvatar && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cabeçalho de página: título + subtítulo, com botões de ação opcionais. */
export function SkeletonPageHeader({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-36" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Campos de formulário dentro de diálogo ou cartão. */
export function SkeletonForm({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-4" aria-busy>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

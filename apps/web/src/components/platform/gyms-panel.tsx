"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Sheet } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTableRows } from "@/components/ui/skeleton";
import { GymSheet } from "@/components/platform/gym-sheet";
import { useCreatePlatformGym, usePlatformGyms } from "@/hooks/use-platform";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function NewGymSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createGym = useCreatePlatformGym();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createGym.mutateAsync({ name });
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a academia.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Nova academia"
      description="O gestor você define depois."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-gym-form" disabled={createGym.isPending}>
            {createGym.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar academia
          </Button>
        </>
      }
    >
      <form id="new-gym-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="gym-name">Nome</Label>
          <Input
            id="gym-name"
            autoFocus
            placeholder="Ex.: RFitness Centro"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            A unidade nasce vazia e sem gestor: estoque, alunos e financeiro próprios. Para dar
            acesso, abra a conta do gestor na aba Contas e marque esta academia.
          </p>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Sheet>
  );
}

/** Lista paginada das academias; o detalhe abre num painel lateral. */
export function GymsPanel() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isLoading } = usePlatformGyms({ search: search.trim() || undefined, page });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Buscar academia"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Nova academia
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Academia</TableHead>
            <TableHead>Dono</TableHead>
            <TableHead>Alunos</TableHead>
            <TableHead>Produtos</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonTableRows rows={5} columns={6} />
          ) : data && data.items.length > 0 ? (
            data.items.map((gym) => (
              <TableRow key={gym.id} onClick={() => setSelectedId(gym.id)} className="cursor-pointer">
                <TableCell>
                  <p className="font-medium">{gym.name}</p>
                  <p className="text-xs text-muted-foreground">{gym.slug}</p>
                </TableCell>

                <TableCell>
                  {gym.owner ? (
                    <>
                      <p className="text-sm">{gym.owner.name}</p>
                      <p className="text-xs text-muted-foreground">{gym.owner.email}</p>
                      {gym.managers.length > 1 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          +{gym.managers.length - 1} com acesso
                        </p>
                      )}
                    </>
                  ) : gym.managers.length > 0 ? (
                    // Sem dono, mas com quem opere: dizer "sem gestor" mandaria o
                    // admin procurar um problema que não existe.
                    <span className="text-xs text-muted-foreground">
                      sem dono · {gym.managers.length} com acesso
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem gestor</span>
                  )}
                </TableCell>

                <TableCell>{gym.counts.students}</TableCell>
                <TableCell>{gym.counts.products}</TableCell>
                <TableCell>{formatDate(gym.createdAt)}</TableCell>

                <TableCell>
                  <Badge variant={gym.isActive ? "default" : "destructive"}>
                    {gym.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Nenhuma academia cadastrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data && (
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
      )}

      <NewGymSheet open={creating} onOpenChange={setCreating} />
      <GymSheet gymId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

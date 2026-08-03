"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonList } from "@/components/ui/skeleton";
import { useCreateGym, useMyGyms, useUpdateGym, type Gym } from "@/hooks/use-gyms";
import { useSession, useSwitchGym } from "@/hooks/use-session";
import AcademiasLoading from "./loading";

function GymCard({ gym, isActive }: { gym: Gym; isActive: boolean }) {
  const switchGym = useSwitchGym();
  const updateGym = useUpdateGym();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(gym.name);

  async function handleActivate() {
    await switchGym.mutateAsync(gym.id);
    // Navegação completa: a academia ativa muda a shell inteira, e o cache de
    // rotas do App Router não sabe disso — ver `gym-switcher.tsx`.
    window.location.assign("/dashboard");
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    await updateGym.mutateAsync({ id: gym.id, name });
    setRenaming(false);
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          {renaming ? (
            <form onSubmit={handleRename} className="flex items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-56" required />
              <Button type="submit" size="sm" disabled={updateGym.isPending}>
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(gym.name);
                  setRenaming(false);
                }}
              >
                Cancelar
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="truncate font-semibold">{gym.name}</span>
              {isActive && <Badge>Ativa agora</Badge>}
              {!gym.isActive && <Badge variant="destructive">Desativada</Badge>}
              {gym.isOwner && <Badge variant="outline">Você é o gestor</Badge>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {gym.counts.students} aluno(s) · {gym.counts.products} produto(s) · {gym.counts.users}{" "}
            usuário(s) · papéis: {gym.roles.join(", ") || "nenhum"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="h-4 w-4" aria-hidden />
              Em uso
            </span>
          ) : (
            <Button size="sm" onClick={handleActivate} disabled={switchGym.isPending}>
              {switchGym.isPending ? "Trocando..." : "Acessar"}
            </Button>
          )}
          {gym.isOwner && !renaming && (
            <>
              <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
                Renomear
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={updateGym.isPending}
                onClick={() => updateGym.mutate({ id: gym.id, isActive: !gym.isActive })}
              >
                {gym.isActive ? "Desativar" : "Reativar"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NewGymDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createGym = useCreateGym();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createGym.mutateAsync(name);
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a academia.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Nova academia</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gym-name">Nome da unidade</Label>
          <Input
            id="gym-name"
            autoFocus
            placeholder="Ex.: RFitness Centro"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            A unidade nasce vazia e independente: estoque, alunos e financeiro próprios.
          </p>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createGym.isPending}>
            {createGym.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Criando...
              </>
            ) : (
              "Criar academia"
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * A rede do gestor. É a tela de pouso de quem foi aprovado e ainda não escolheu
 * uma unidade — por isso ela precisa funcionar sem academia ativa.
 */
function AcademiasContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { data: gyms, isLoading } = useMyGyms();
  const [isFormOpen, setFormOpen] = useState(false);

  // `?nova=1` vem do atalho "Nova academia" do seletor da topbar: abre o
  // diálogo direto, sem obrigar a caçar o botão na página.
  useEffect(() => {
    if (searchParams.get("nova") === "1") setFormOpen(true);
  }, [searchParams]);

  const activeGymId = session?.gym?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Minhas academias</h1>
          <p className="text-sm text-muted-foreground">
            A RFitness reúne suas unidades. Cada uma tem estoque, alunos e financeiro separados.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova academia
        </Button>
      </div>

      {isLoading ? (
        <SkeletonList items={3} />
      ) : gyms && gyms.length > 0 ? (
        <div className="space-y-3">
          {gyms.map((gym) => (
            <GymCard key={gym.id} gym={gym} isActive={gym.id === activeGymId} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Você ainda não tem nenhuma academia. Crie a primeira para começar a usar o painel.
            </p>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar academia
            </Button>
          </CardContent>
        </Card>
      )}

      <NewGymDialog open={isFormOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

/**
 * `useSearchParams` exige um boundary de Suspense no App Router; por isso o
 * conteúdo vive num componente separado.
 */
export default function AcademiasPage() {
  return (
    <Suspense fallback={<AcademiasLoading />}>
      <AcademiasContent />
    </Suspense>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTableRows } from "@/components/ui/skeleton";
import {
  useCreatePlatformGym,
  useDeletePlatformGym,
  useGrantGymAccess,
  useManagerAccounts,
  usePlatformGyms,
  useRevokeGymAccess,
  useUpdatePlatformGym,
  type PlatformGym,
} from "@/hooks/use-platform";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function NewGymDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createGym = useCreatePlatformGym();
  const { data: accounts } = useManagerAccounts({ status: "ACTIVE" });
  const [name, setName] = useState("");
  const [ownerAccountId, setOwnerAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createGym.mutateAsync({ name, ownerAccountId });
      setName("");
      setOwnerAccountId("");
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
          <Label htmlFor="gym-name">Nome</Label>
          <Input id="gym-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gym-owner">Gestor dono</Label>
          <Select
            id="gym-owner"
            value={ownerAccountId}
            onChange={(e) => setOwnerAccountId(e.target.value)}
            required
          >
            <option value="">Selecione um gestor ativo</option>
            {accounts?.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} — {account.email}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Ele passa a gerenciar a unidade imediatamente. Só contas ativas aparecem aqui.
          </p>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createGym.isPending || !ownerAccountId}>
            {createGym.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar academia
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ManagersDialog({ gym, onOpenChange }: { gym: PlatformGym | null; onOpenChange: () => void }) {
  const { data: accounts } = useManagerAccounts({ status: "ACTIVE" });
  const grant = useGrantGymAccess();
  const revoke = useRevokeGymAccess();
  const updateGym = useUpdatePlatformGym();
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!gym) return null;

  const alreadyIn = new Set(gym.managers.map((manager) => manager.accountId));

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Gestores — {gym.name}</DialogTitle>
        <DialogCloseButton onClick={onOpenChange} />
      </DialogHeader>

      <div className="space-y-4">
        <ul className="divide-y divide-border rounded-md border border-border">
          {gym.managers.map((manager) => (
            <li key={manager.email} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{manager.name}</p>
                <p className="truncate text-xs text-muted-foreground">{manager.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {manager.isOwner ? (
                  <Badge>dono</Badge>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!manager.accountId || updateGym.isPending}
                      onClick={() =>
                        run(() =>
                          updateGym.mutateAsync({ id: gym.id, ownerAccountId: manager.accountId! }),
                        )
                      }
                    >
                      Tornar dono
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!manager.accountId || revoke.isPending}
                      onClick={() =>
                        run(() => revoke.mutateAsync({ gymId: gym.id, accountId: manager.accountId! }))
                      }
                      title="Remover acesso"
                    >
                      <UserMinus className="h-4 w-4 text-brand-red" aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Label htmlFor="grant-account">Dar acesso a outro gestor</Label>
          <div className="flex gap-2">
            <Select id="grant-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Selecione um gestor ativo</option>
              {accounts
                ?.filter((account) => !alreadyIn.has(account.id))
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} — {account.email}
                  </option>
                ))}
            </Select>
            <Button
              disabled={!accountId || grant.isPending}
              onClick={() =>
                run(async () => {
                  await grant.mutateAsync({ gymId: gym.id, accountId });
                  setAccountId("");
                })
              }
            >
              <UserPlus className="mr-2 h-4 w-4" aria-hidden />
              Conceder
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}
      </div>
    </Dialog>
  );
}

function GymRow({
  gym,
  onManagers,
  onDelete,
}: {
  gym: PlatformGym;
  onManagers: (gym: PlatformGym) => void;
  onDelete: (gym: PlatformGym) => void;
}) {
  const updateGym = useUpdatePlatformGym();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(gym.name);

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    await updateGym.mutateAsync({ id: gym.id, name });
    setRenaming(false);
  }

  return (
    <TableRow>
      <TableCell>
        {renaming ? (
          <form onSubmit={handleRename} className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-48" required />
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
          <>
            <p className="font-medium">{gym.name}</p>
            <p className="text-xs text-muted-foreground">{gym.slug}</p>
          </>
        )}
      </TableCell>

      <TableCell>
        {gym.owner ? (
          <>
            <p className="text-sm">{gym.owner.name}</p>
            <p className="text-xs text-muted-foreground">{gym.owner.email}</p>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">sem dono</span>
        )}
        {gym.managers.length > 1 && (
          <p className="mt-1 text-xs text-muted-foreground">+{gym.managers.length - 1} com acesso</p>
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

      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => onManagers(gym)}>
            Gestores
          </Button>
          {!renaming && (
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
              Renomear
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={updateGym.isPending}
            onClick={() => updateGym.mutate({ id: gym.id, isActive: !gym.isActive })}
          >
            {gym.isActive ? "Desativar" : "Reativar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(gym)} title="Excluir academia">
            <Trash2 className="h-4 w-4 text-brand-red" aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** CRUD das academias, do ponto de vista da plataforma. */
export function GymsPanel() {
  const { data: gyms, isLoading } = usePlatformGyms();
  const deleteGym = useDeletePlatformGym();
  const [creating, setCreating] = useState(false);
  const [managersFor, setManagersFor] = useState<PlatformGym | null>(null);
  const [deleting, setDeleting] = useState<PlatformGym | null>(null);

  // A linha do diálogo precisa acompanhar a lista: depois de conceder acesso, o
  // objeto capturado no clique estaria desatualizado e a lista de gestores não
  // mostraria quem acabou de entrar.
  const managersGym = managersFor
    ? (gyms?.find((gym) => gym.id === managersFor.id) ?? managersFor)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {gyms?.length ?? 0} academia(s) na plataforma.
        </p>
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
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonTableRows rows={5} columns={7} />
          ) : gyms && gyms.length > 0 ? (
            gyms.map((gym) => (
              <GymRow key={gym.id} gym={gym} onManagers={setManagersFor} onDelete={setDeleting} />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                Nenhuma academia cadastrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <NewGymDialog open={creating} onOpenChange={setCreating} />
      <ManagersDialog gym={managersGym} onOpenChange={() => setManagersFor(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={() => setDeleting(null)}
        title="Excluir academia"
        confirmLabel="Excluir definitivamente"
        confirmText={deleting?.name}
        description={
          <>
            <p>
              Excluir <strong>{deleting?.name}</strong> apaga junto alunos, estoque, vendas, pedidos e
              todo o histórico financeiro da unidade.
            </p>
            <p>
              Hoje: {deleting?.counts.students ?? 0} aluno(s) e {deleting?.counts.products ?? 0}{" "}
              produto(s). Não há como desfazer.
            </p>
          </>
        }
        onConfirm={() => deleteGym.mutateAsync(deleting!.id)}
      />
    </div>
  );
}

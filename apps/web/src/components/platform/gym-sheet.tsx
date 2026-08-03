"use client";

import { FormEvent, useEffect, useState } from "react";
import { Crown, Loader2, Trash2, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetField, SheetSection } from "@/components/ui/sheet";
import {
  useDeletePlatformGym,
  usePlatformGym,
  useRevokeGymAccess,
  useUpdatePlatformGym,
} from "@/hooks/use-platform";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Detalhe da academia.
 *
 * Mostra quem tem acesso e permite tirar, mas conceder é no detalhe do gestor:
 * duas telas concedendo a mesma coisa dariam dois lugares para procurar quando
 * algo estivesse errado.
 */
export function GymSheet({ gymId, onClose }: { gymId: string | null; onClose: () => void }) {
  const { data: gym, isLoading } = usePlatformGym(gymId);
  const updateGym = useUpdatePlatformGym();
  const revoke = useRevokeGymAccess();
  const deleteGym = useDeletePlatformGym();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!gym) return;
    setName(gym.name);
    setError(null);
  }, [gym?.id, gym]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    }
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    if (!gym) return;
    await run(() => updateGym.mutateAsync({ id: gym.id, name }));
  }

  return (
    <>
      <Sheet
        open={gymId !== null}
        onOpenChange={onClose}
        title={gym?.name ?? "Academia"}
        description={gym?.slug}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button variant="outline" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4 text-brand-red" aria-hidden />
              Excluir
            </Button>
          </>
        }
      >
        {isLoading || !gym ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6">
            {error && (
              <p className="rounded-md border border-brand-red/30 bg-brand-red/5 p-3 text-sm text-brand-red">
                {error}
              </p>
            )}

            <SheetSection title="Resumo">
              <div className="space-y-2">
                <SheetField label="Status">
                  <Badge variant={gym.isActive ? "default" : "destructive"}>
                    {gym.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </SheetField>
                <SheetField label="Criada em">{formatDate(gym.createdAt)}</SheetField>
                <SheetField label="Alunos">{gym.counts.students}</SheetField>
                <SheetField label="Produtos">{gym.counts.products}</SheetField>
                <SheetField label="Gestores com acesso">{gym.managers.length}</SheetField>
              </div>

              <Button
                size="sm"
                variant="outline"
                disabled={updateGym.isPending}
                onClick={() => run(() => updateGym.mutateAsync({ id: gym.id, isActive: !gym.isActive }))}
              >
                {gym.isActive ? "Desativar academia" : "Reativar academia"}
              </Button>
            </SheetSection>

            <SheetSection title="Nome">
              <form onSubmit={handleRename} className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
                <Button type="submit" size="sm" disabled={updateGym.isPending}>
                  {updateGym.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </form>
            </SheetSection>

            <SheetSection
              title="Quem gerencia"
              description="Para dar acesso a alguém, abra a conta do gestor na aba Contas."
            >
              {gym.managers.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nenhum gestor ainda. A academia existe, mas ninguém consegue operá-la — defina o
                  acesso pelo detalhe de uma conta.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {gym.managers.map((manager) => (
                    <li key={manager.email} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{manager.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{manager.email}</p>
                      </div>

                      {manager.isOwner ? (
                        <Badge className="gap-1">
                          <Crown className="h-3 w-3" aria-hidden />
                          dono
                        </Badge>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!manager.accountId || updateGym.isPending}
                            onClick={() =>
                              run(() =>
                                updateGym.mutateAsync({
                                  id: gym.id,
                                  ownerAccountId: manager.accountId!,
                                }),
                              )
                            }
                          >
                            Tornar dono
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!manager.accountId || revoke.isPending}
                            title="Remover acesso"
                            onClick={() =>
                              run(() =>
                                revoke.mutateAsync({ gymId: gym.id, accountId: manager.accountId! }),
                              )
                            }
                          >
                            <UserMinus className="h-4 w-4 text-brand-red" aria-hidden />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SheetSection>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Excluir academia"
        confirmLabel="Excluir definitivamente"
        confirmText={gym?.name}
        description={
          <>
            <p>
              Excluir <strong>{gym?.name}</strong> apaga junto alunos, estoque, vendas, pedidos e todo
              o histórico financeiro da unidade.
            </p>
            <p>
              Hoje: {gym?.counts.students ?? 0} aluno(s) e {gym?.counts.products ?? 0} produto(s). Não
              há como desfazer.
            </p>
          </>
        }
        onConfirm={async () => {
          await deleteGym.mutateAsync(gym!.id);
          onClose();
        }}
      />
    </>
  );
}

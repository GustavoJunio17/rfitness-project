"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Check, KeyRound, Loader2, Lock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetField, SheetSection } from "@/components/ui/sheet";
import { maskPhone, onlyDigits } from "@/lib/masks";
import { cn } from "@/lib/utils";
import {
  useDeleteManagerAccount,
  useGrantGymAccess,
  useGymOptions,
  useManagerAccount,
  useRevokeGymAccess,
  useSetAccountPassword,
  useUpdateManagerAccount,
  type ManagerAccountStatus,
} from "@/hooks/use-platform";

const STATUS_LABELS: Record<ManagerAccountStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativa",
  REJECTED: "Recusada",
  SUSPENDED: "Suspensa",
};

const STATUS_VARIANTS: Record<ManagerAccountStatus, "default" | "outline" | "destructive" | "warning"> = {
  PENDING: "warning",
  ACTIVE: "default",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Detalhe do gestor.
 *
 * É aqui que se decide a quais academias ele tem acesso — a pergunta natural é
 * "o que esta pessoa gerencia?", e não "quem gerencia esta academia?". Um
 * gestor com cinco unidades resolve tudo numa tela só.
 */
export function AccountSheet({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const { data: account, isLoading } = useManagerAccount(accountId);
  const { data: gymOptions } = useGymOptions();

  const updateAccount = useUpdateManagerAccount();
  const setPassword = useSetAccountPassword();
  const deleteAccount = useDeleteManagerAccount();
  const grant = useGrantGymAccess();
  const revoke = useRevokeGymAccess();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [password, setPassword2] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pendingGymId, setPendingGymId] = useState<string | null>(null);

  // Recarrega os campos quando o painel troca de conta; sem isso o formulário
  // ficaria mostrando os dados do gestor anterior.
  useEffect(() => {
    if (!account) return;
    setName(account.name);
    // O banco guarda dígitos; a máscara é reaplicada ao abrir para edição.
    setPhone(maskPhone(account.phone ?? ""));
    setNotes(account.notes ?? "");
    setError(null);
    setPassword2("");
    setPasswordDone(false);
  }, [account?.id, account]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    }
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    await run(() =>
      updateAccount.mutateAsync({
        id: account.id,
        name,
        phone: onlyDigits(phone) || null,
        notes: notes || null,
      }),
    );
  }

  async function toggleGym(gymId: string, hasAccess: boolean) {
    if (!account) return;
    setPendingGymId(gymId);
    await run(() =>
      hasAccess
        ? revoke.mutateAsync({ gymId, accountId: account.id })
        : grant.mutateAsync({ gymId, accountId: account.id }),
    );
    setPendingGymId(null);
  }

  const accessById = new Map((account?.gyms ?? []).map((gym) => [gym.id, gym]));

  return (
    <>
      <Sheet
        open={accountId !== null}
        onOpenChange={onClose}
        title={account?.name ?? "Conta de gestor"}
        description={account?.email}
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
        {isLoading || !account ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6">
            {error && (
              <p className="rounded-md border border-brand-red/30 bg-brand-red/5 p-3 text-sm text-brand-red">
                {error}
              </p>
            )}

            <SheetSection title="Situação">
              <div className="space-y-2">
                <SheetField label="Status">
                  <Badge variant={STATUS_VARIANTS[account.status]}>
                    {STATUS_LABELS[account.status]}
                  </Badge>
                </SheetField>
                <SheetField label="Criada em">{formatDate(account.createdAt)}</SheetField>
                {account.reviewerName && (
                  <SheetField label="Decidida por">{account.reviewerName}</SheetField>
                )}
                {account.decisionReason && (
                  <p className="rounded-md border border-border bg-muted/40 p-2 text-xs">
                    {account.decisionReason}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {account.status !== "ACTIVE" && (
                  <Button
                    size="sm"
                    disabled={updateAccount.isPending}
                    onClick={() => run(() => updateAccount.mutateAsync({ id: account.id, status: "ACTIVE" }))}
                  >
                    {account.status === "PENDING" ? "Liberar acesso" : "Reativar"}
                  </Button>
                )}
                {account.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateAccount.isPending}
                    onClick={() =>
                      run(() => updateAccount.mutateAsync({ id: account.id, status: "REJECTED" }))
                    }
                  >
                    Recusar
                  </Button>
                )}
                {account.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateAccount.isPending}
                    onClick={() =>
                      run(() => updateAccount.mutateAsync({ id: account.id, status: "SUSPENDED" }))
                    }
                  >
                    Suspender
                  </Button>
                )}
              </div>
            </SheetSection>

            <SheetSection
              title="Academias que gerencia"
              description="Marque as unidades a que este gestor tem acesso."
            >
              {account.status !== "ACTIVE" && (
                <p className="text-xs text-muted-foreground">
                  Libere a conta para poder conceder acesso.
                </p>
              )}

              <ul className="space-y-1">
                {gymOptions?.length ? (
                  gymOptions.map((gym) => {
                    const access = accessById.get(gym.id);
                    const hasAccess = access !== undefined;
                    const isOwner = access?.isOwner ?? false;
                    const busy = pendingGymId === gym.id;

                    return (
                      <li key={gym.id}>
                        <button
                          type="button"
                          disabled={isOwner || busy || account.status !== "ACTIVE"}
                          onClick={() => toggleGym(gym.id, hasAccess)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            hasAccess
                              ? "border-brand-red/40 bg-brand-red/5"
                              : "border-border hover:bg-muted",
                            (isOwner || account.status !== "ACTIVE") && "cursor-not-allowed opacity-70",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              hasAccess ? "border-brand-red bg-brand-red text-white" : "border-border",
                            )}
                            aria-hidden
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : hasAccess ? (
                              <Check className="h-3 w-3" />
                            ) : null}
                          </span>

                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{gym.name}</span>

                          {!gym.isActive && <Badge variant="outline">inativa</Badge>}
                          {isOwner && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" aria-hidden />
                              dono
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="text-xs text-muted-foreground">
                    Nenhuma academia cadastrada ainda.
                  </li>
                )}
              </ul>

              <p className="text-xs text-muted-foreground">
                O dono não pode perder o acesso — troque o dono na aba Academias antes.
              </p>
            </SheetSection>

            <SheetSection title="Dados">
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-name">Nome</Label>
                  <Input id="detail-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-phone">Telefone</Label>
                  <Input
                    id="detail-phone"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-notes">Observações internas</Label>
                  <textarea
                    id="detail-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <Button type="submit" size="sm" disabled={updateAccount.isPending}>
                  {updateAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar dados
                </Button>
              </form>
            </SheetSection>

            <SheetSection title="Senha" description="Defina uma senha nova; o gestor pode trocá-la depois.">
              <form
                className="flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await run(async () => {
                    await setPassword.mutateAsync({ id: account.id, password });
                    setPassword2("");
                    setPasswordDone(true);
                  });
                }}
              >
                <Input
                  value={password}
                  onChange={(e) => {
                    setPassword2(e.target.value);
                    setPasswordDone(false);
                  }}
                  placeholder="Nova senha"
                  required
                />
                <Button type="submit" size="sm" variant="outline" disabled={setPassword.isPending}>
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                  Definir
                </Button>
              </form>
              {passwordDone && <p className="text-xs text-emerald-600">Senha definida.</p>}
            </SheetSection>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Excluir conta"
        confirmLabel="Excluir conta"
        description={
          <>
            <p>
              A conta <strong>{account?.name}</strong> ({account?.email}) será removida do Supabase
              Auth e perderá o acesso a todas as academias.
            </p>
            <p>Academias das quais ela é dona precisam ser transferidas ou excluídas antes.</p>
          </>
        }
        onConfirm={async () => {
          await deleteAccount.mutateAsync(account!.id);
          onClose();
        }}
      />
    </>
  );
}

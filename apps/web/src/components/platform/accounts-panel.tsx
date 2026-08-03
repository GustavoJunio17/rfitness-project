"use client";

import { FormEvent, useState } from "react";
import { Building2, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
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
  useCreateManagerAccount,
  useDeleteManagerAccount,
  useManagerAccounts,
  useSetAccountPassword,
  useUpdateManagerAccount,
  type ManagerAccount,
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

function NewAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createAccount = useCreateManagerAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createAccount.mutateAsync({ name, email, password, phone: phone || undefined });
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Nova conta de gestor</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="account-name">Nome</Label>
          <Input id="account-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">E-mail</Label>
          <Input
            id="account-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-phone">Telefone (opcional)</Label>
          <Input id="account-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-password">Senha inicial</Label>
          <Input
            id="account-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Repasse ao gestor; ele troca depois em Conta. Criada por você, a conta já nasce ativa.
          </p>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createAccount.isPending}>
            {createAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar conta
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordDialog({
  account,
  onOpenChange,
}: {
  account: ManagerAccount | null;
  onOpenChange: (v: boolean) => void;
}) {
  const setPassword = useSetAccountPassword();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    setError(null);
    try {
      await setPassword.mutateAsync({ id: account.id, password: value });
      setDone(true);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível definir a senha.");
    }
  }

  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Definir senha — {account?.name}</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="text"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDone(false);
            }}
            required
          />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        {done && <p className="text-sm text-emerald-600">Senha definida.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="submit" disabled={setPassword.isPending}>
            {setPassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Definir senha
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function AccountRow({
  account,
  onPassword,
  onDelete,
}: {
  account: ManagerAccount;
  onPassword: (account: ManagerAccount) => void;
  onDelete: (account: ManagerAccount) => void;
}) {
  const updateAccount = useUpdateManagerAccount();
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(status: ManagerAccountStatus) {
    setError(null);
    try {
      await updateAccount.mutateAsync({ id: account.id, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o status.");
    }
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{account.name}</p>
        <p className="text-xs text-muted-foreground">{account.email}</p>
        {account.phone && <p className="text-xs text-muted-foreground">{account.phone}</p>}
      </TableCell>

      <TableCell>
        {account.gyms.length === 0 ? (
          <span className="text-xs text-muted-foreground">nenhuma</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {account.gyms.map((gym) => (
              <Badge key={gym.id} variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" aria-hidden />
                {gym.name}
                {gym.isOwner && <span className="text-[10px] opacity-70">dono</span>}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>

      <TableCell>{formatDate(account.createdAt)}</TableCell>

      <TableCell>
        <Badge variant={STATUS_VARIANTS[account.status]}>{STATUS_LABELS[account.status]}</Badge>
        {account.reviewerName && (
          <p className="mt-1 text-xs text-muted-foreground">por {account.reviewerName}</p>
        )}
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap gap-1">
          {account.status !== "ACTIVE" && (
            <Button size="sm" onClick={() => changeStatus("ACTIVE")} disabled={updateAccount.isPending}>
              {account.status === "PENDING" ? "Liberar" : "Reativar"}
            </Button>
          )}
          {account.status === "PENDING" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => changeStatus("REJECTED")}
              disabled={updateAccount.isPending}
            >
              Recusar
            </Button>
          )}
          {account.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => changeStatus("SUSPENDED")}
              disabled={updateAccount.isPending}
            >
              Suspender
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onPassword(account)} title="Definir senha">
            <KeyRound className="h-4 w-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(account)} title="Excluir conta">
            <Trash2 className="h-4 w-4 text-brand-red" aria-hidden />
          </Button>
        </div>
        {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      </TableCell>
    </TableRow>
  );
}

/** CRUD das contas de gestor. */
export function AccountsPanel() {
  const [status, setStatus] = useState<ManagerAccountStatus | "">("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [passwordFor, setPasswordFor] = useState<ManagerAccount | null>(null);
  const [deleting, setDeleting] = useState<ManagerAccount | null>(null);

  const { data: accounts, isLoading } = useManagerAccounts({
    status: status || undefined,
    search: search.trim() || undefined,
  });
  const deleteAccount = useDeleteManagerAccount();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select
            className="w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value as ManagerAccountStatus | "")}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            <option value="PENDING">Pendentes</option>
            <option value="ACTIVE">Ativas</option>
            <option value="SUSPENDED">Suspensas</option>
            <option value="REJECTED">Recusadas</option>
          </Select>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Nova conta
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gestor</TableHead>
            <TableHead>Academias</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonTableRows rows={5} columns={5} />
          ) : accounts && accounts.length > 0 ? (
            accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onPassword={setPasswordFor}
                onDelete={setDeleting}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Nenhuma conta neste filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <NewAccountDialog open={creating} onOpenChange={setCreating} />
      <PasswordDialog account={passwordFor} onOpenChange={() => setPasswordFor(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={() => setDeleting(null)}
        title="Excluir conta"
        confirmLabel="Excluir conta"
        description={
          <>
            <p>
              A conta <strong>{deleting?.name}</strong> ({deleting?.email}) será removida do Supabase
              Auth e perderá o acesso a todas as academias.
            </p>
            <p>Academias das quais ela é dona precisam ser transferidas ou excluídas antes.</p>
          </>
        }
        onConfirm={() => deleteAccount.mutateAsync(deleting!.id)}
      />
    </div>
  );
}

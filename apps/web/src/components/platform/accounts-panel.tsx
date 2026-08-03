"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTableRows } from "@/components/ui/skeleton";
import { AccountSheet } from "@/components/platform/account-sheet";
import {
  useCreateManagerAccount,
  useManagerAccounts,
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

function NewAccountSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Nova conta de gestor"
      description="Criada por você, a conta já nasce ativa."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-account-form" disabled={createAccount.isPending}>
            {createAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar conta
          </Button>
        </>
      }
    >
      <form id="new-account-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="account-name">Nome</Label>
          <Input id="account-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-email">E-mail</Label>
          <Input
            id="account-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-phone">Telefone (opcional)</Label>
          <Input id="account-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-password">Senha inicial</Label>
          <Input
            id="account-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Repasse ao gestor; ele troca depois em Conta. As academias que ele vai gerenciar você
            define no detalhe da conta.
          </p>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Sheet>
  );
}

/** Lista paginada das contas de gestor; o detalhe abre num painel lateral. */
export function AccountsPanel() {
  const [status, setStatus] = useState<ManagerAccountStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filtro novo com a página antiga mostraria "nenhum resultado" numa busca que
  // tem resultados na primeira página.
  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const { data, isLoading } = useManagerAccounts({
    status: status || undefined,
    search: search.trim() || undefined,
    page,
  });

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
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonTableRows rows={5} columns={4} />
          ) : data && data.items.length > 0 ? (
            data.items.map((account) => (
              <TableRow
                key={account.id}
                onClick={() => setSelectedId(account.id)}
                className="cursor-pointer"
              >
                <TableCell>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">{account.email}</p>
                </TableCell>

                <TableCell>
                  {account.gyms.length === 0 ? (
                    <span className="text-xs text-muted-foreground">nenhuma</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {account.gyms.slice(0, 3).map((gym) => (
                        <Badge key={gym.id} variant="outline" className="gap-1">
                          <Building2 className="h-3 w-3" aria-hidden />
                          {gym.name}
                        </Badge>
                      ))}
                      {account.gyms.length > 3 && (
                        <Badge variant="outline">+{account.gyms.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </TableCell>

                <TableCell>{formatDate(account.createdAt)}</TableCell>

                <TableCell>
                  <Badge variant={STATUS_VARIANTS[account.status]}>
                    {STATUS_LABELS[account.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                Nenhuma conta neste filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data && (
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
      )}

      <NewAccountSheet open={creating} onOpenChange={setCreating} />
      <AccountSheet accountId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

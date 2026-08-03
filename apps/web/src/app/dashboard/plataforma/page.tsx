"use client";

import { useState } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonStatCards, SkeletonTableRows } from "@/components/ui/skeleton";
import {
  useAccessRequests,
  useApproveAccessRequest,
  usePlatformGyms,
  usePlatformOverview,
  useRejectAccessRequest,
  type AccessRequest,
  type AccessRequestStatus,
  type ApprovalResult,
} from "@/hooks/use-platform";

const STATUS_LABELS: Record<AccessRequestStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
};

const STATUS_VARIANTS: Record<AccessRequestStatus, "default" | "outline" | "destructive" | "warning"> = {
  PENDING: "warning",
  APPROVED: "default",
  REJECTED: "destructive",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Confirmação da liberação. Não há credencial a repassar nem academia a
 * escolher: a conta já existia desde o cadastro, com a senha da própria pessoa,
 * e as unidades quem cadastra é ela.
 */
function ApprovalReceipt({ result, onDismiss }: { result: ApprovalResult; onDismiss: () => void }) {
  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
          <div>
            <p className="font-semibold">Acesso liberado para {result.requesterName}.</p>
            <p className="text-sm text-muted-foreground">
              {result.email} já pode cadastrar as academias dele. Nada precisa ser enviado por fora:
              a senha é a que a pessoa escolheu no cadastro.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function RequestRow({
  request,
  onApproved,
}: {
  request: AccessRequest;
  onApproved: (result: ApprovalResult) => void;
}) {
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = approve.isPending || reject.isPending;

  async function handleApprove() {
    setError(null);
    try {
      onApproved(await approve.mutateAsync(request.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aprovar.");
    }
  }

  async function handleReject() {
    setError(null);
    try {
      await reject.mutateAsync({ id: request.id, reason });
      setRejecting(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível recusar.");
    }
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{request.requesterName}</p>
        <p className="text-xs text-muted-foreground">{request.requesterEmail}</p>
        {request.phone && <p className="text-xs text-muted-foreground">{request.phone}</p>}
      </TableCell>
      <TableCell>{formatDate(request.createdAt)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[request.status]}>{STATUS_LABELS[request.status]}</Badge>
        {request.reviewerName && (
          <p className="mt-1 text-xs text-muted-foreground">por {request.reviewerName}</p>
        )}
        {request.decisionReason && (
          <p className="mt-1 text-xs text-muted-foreground">{request.decisionReason}</p>
        )}
      </TableCell>
      <TableCell>
        {request.status !== "PENDING" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : rejecting ? (
          <div className="flex flex-col gap-2">
            <Input
              autoFocus
              placeholder="Motivo da recusa"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleReject} disabled={busy || reason.length < 3}>
                Confirmar recusa
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApprove} disabled={busy}>
              {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(true)} disabled={busy}>
              Recusar
            </Button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      </TableCell>
    </TableRow>
  );
}

/** Console da RFitness: quem entra na plataforma e quais academias existem. */
export default function PlataformaPage() {
  const [statusFilter, setStatusFilter] = useState<AccessRequestStatus | "">("PENDING");
  const [receipt, setReceipt] = useState<ApprovalResult | null>(null);

  const { data: overview, isLoading: loadingOverview } = usePlatformOverview();
  const { data: requests, isLoading: loadingRequests } = useAccessRequests(statusFilter || undefined);
  const { data: gyms, isLoading: loadingGyms } = usePlatformGyms();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-brand-red" aria-hidden />
          Plataforma
        </h1>
        <p className="text-sm text-muted-foreground">
          Administração da RFitness: libera o acesso dos gestores e acompanha a rede de academias.
        </p>
      </div>

      {loadingOverview ? (
        <SkeletonStatCards count={4} />
      ) : (
        overview && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Cadastros pendentes</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.requests.pending}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Academias ativas</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {overview.gyms.active}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  de {overview.gyms.total}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Gestores</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.managers}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Cadastros decididos</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {overview.requests.approved + overview.requests.rejected}
              </CardContent>
            </Card>
          </div>
        )
      )}

      {receipt && <ApprovalReceipt result={receipt} onDismiss={() => setReceipt(null)} />}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Cadastros de gestores</h2>
          <Select
            className="w-48"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccessRequestStatus | "")}
            aria-label="Filtrar por status"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendentes</option>
            <option value="APPROVED">Aprovados</option>
            <option value="REJECTED">Recusados</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Solicitante</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingRequests ? (
              <SkeletonTableRows rows={4} columns={4} />
            ) : requests && requests.length > 0 ? (
              requests.map((request) => (
                <RequestRow key={request.id} request={request} onApproved={setReceipt} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nenhum cadastro neste filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Academias da rede</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Academia</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Alunos</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingGyms ? (
              <SkeletonTableRows rows={4} columns={6} />
            ) : gyms && gyms.length > 0 ? (
              gyms.map((gym) => (
                <TableRow key={gym.id}>
                  <TableCell>
                    <p className="font-medium">{gym.name}</p>
                    <p className="text-xs text-muted-foreground">{gym.slug}</p>
                  </TableCell>
                  <TableCell>
                    {gym.owner ? (
                      <>
                        <p>{gym.owner.name}</p>
                        <p className="text-xs text-muted-foreground">{gym.owner.email}</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">sem gestor</span>
                    )}
                  </TableCell>
                  <TableCell>{gym.counts.students}</TableCell>
                  <TableCell>{gym.counts.products}</TableCell>
                  <TableCell>{formatDate(gym.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={gym.isActive ? "default" : "destructive"}>
                      {gym.isActive ? "Ativa" : "Desativada"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhuma academia cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

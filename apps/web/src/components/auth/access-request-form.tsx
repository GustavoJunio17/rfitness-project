"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { AuthError, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Resumo copiável da falha inesperada — `PrismaClientKnownRequestError · P2021`.
 * Só para 5xx: em erro de validação o usuário já tem a mensagem que importa.
 */
function formatErrorReference(error: ApiError): string | null {
  if (error.status < 500) return null;
  const details = error.details as { type?: string; code?: string | null; reason?: string } | undefined;
  const parts = [details?.type, details?.code, details?.reason].filter(Boolean);
  return parts.length > 0 ? `${error.status} · ${parts.join(" · ")}` : `${error.status}`;
}

const LOGIN_FOOTER = (
  <>
    Já tem acesso?{" "}
    <Link href="/login" className="font-medium text-white hover:text-brand-400">
      Entrar
    </Link>
  </>
);

/**
 * Pedido de acesso à plataforma.
 *
 * Não é um cadastro: nenhuma conta nasce daqui, e por isso o formulário não pede
 * senha. Quem libera o acesso é a administração da RFitness, que cria as
 * credenciais e a primeira academia ao aprovar.
 */
export function AccessRequestForm() {
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gymName, setGymName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setErrorReference(null);
    setLoading(true);

    try {
      await apiFetch("/access-requests", {
        method: "POST",
        allowAnonymous: true,
        body: JSON.stringify({
          requesterName,
          requesterEmail,
          phone: phone || null,
          gymName,
          notes: notes || null,
        }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar o pedido.");
      setErrorReference(err instanceof ApiError ? formatErrorReference(err) : null);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Pedido enviado"
        subtitle="A administração da RFitness vai analisar e responder por e-mail."
        footer={LOGIN_FOOTER}
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Assim que o acesso for liberado, você recebe em{" "}
            <span className="font-medium text-foreground">{requesterEmail}</span> os dados para entrar
            e a primeira academia já criada.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title="Solicitar acesso"
      subtitle="A RFitness libera o acesso de cada gestor manualmente. Conte quem você é e qual academia vai gerenciar."
      footer={LOGIN_FOOTER}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="requesterName">Seu nome</Label>
          <Input
            id="requesterName"
            autoFocus
            autoComplete="name"
            placeholder="Ex.: Maria Silva"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="requesterEmail">E-mail</Label>
          <Input
            id="requesterEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={requesterEmail}
            onChange={(e) => setRequesterEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gymName">Nome da academia</Label>
          <Input
            id="gymName"
            autoComplete="organization"
            placeholder="Ex.: Academia Corpo em Forma"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Depois de aprovado você pode cadastrar quantas unidades quiser.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações (opcional)</Label>
          <textarea
            id="notes"
            rows={3}
            maxLength={1000}
            placeholder="Quantas unidades, quantos alunos, o que você precisa..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {error && <AuthError message={error} reference={errorReference} />}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Enviando...
            </>
          ) : (
            "Enviar pedido"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

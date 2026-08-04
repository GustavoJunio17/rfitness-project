"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, Loader2, X } from "lucide-react";
import { evaluatePassword } from "@rfitness/core";
import { ApiError, apiFetch } from "@/lib/api-client";
import { AuthError, AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

/**
 * Cadastro de gestor: nome, e-mail e senha.
 *
 * A academia não é pedida aqui de propósito — o gestor cadastra as unidades
 * dele depois, quantas quiser. O que a RFitness controla é a liberação da
 * conta: sem ela, não há como criar academia nenhuma, e portanto nada a operar.
 */
export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Reavaliada a cada tecla; nome e e-mail entram como contexto para reprovar
  // senha derivada dos próprios dados do cadastro.
  const strength = useMemo(() => evaluatePassword(password, [name, email]), [password, name, email]);

  const confirmTouched = passwordConfirm.length > 0;
  const passwordsMatch = password === passwordConfirm;
  const canSubmit = strength.acceptable && passwordsMatch && confirmTouched && !loading;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setErrorReference(null);

    if (!strength.acceptable) {
      setError(strength.hint ?? "Escolha uma senha mais forte.");
      return;
    }
    if (!passwordsMatch) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/auth/signup", {
        method: "POST",
        allowAnonymous: true,
        body: JSON.stringify({ requesterName: name, requesterEmail: email, password }),
      });

      // Sem login automático: a conta nasce travada, então entrar levaria direto
      // ao aviso de acesso pendente. Melhor dizer isso aqui, sem o vaivém.
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir o cadastro.");
      setErrorReference(err instanceof ApiError ? formatErrorReference(err) : null);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell
        title="Conta criada"
        subtitle="Falta a liberação da administração da RFitness."
        footer={
          <Link href="/login" className="font-medium text-brand hover:text-brand-600">
            Voltar para o login
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <Clock className="h-10 w-10 text-amber-500" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Sua conta <span className="font-medium text-foreground">{email}</span> foi criada, mas o
            acesso ao painel só é liberado depois que a administração da RFitness aprovar.
          </p>
          <p className="text-sm text-muted-foreground">
            Você recebe um aviso assim que isso acontecer. Até lá, o login fica bloqueado.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title="Criar conta de gestor"
      subtitle="Sua conta é criada na hora, mas só funciona depois que a administração da RFitness liberar o acesso."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-brand hover:text-brand-600">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Seu nome</Label>
          <Input
            id="name"
            autoFocus
            autoComplete="name"
            placeholder="Ex.: Maria Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-strength"
            required
          />
          <div id="password-strength">
            <PasswordStrengthMeter strength={strength} pristine={password.length === 0} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passwordConfirm">Confirmar senha</Label>
          <PasswordInput
            id="passwordConfirm"
            autoComplete="new-password"
            placeholder="••••••••"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            aria-invalid={confirmTouched && !passwordsMatch}
            className={cn(
              confirmTouched && !passwordsMatch && "border-brand focus-visible:ring-brand",
              confirmTouched && passwordsMatch && "border-emerald-500 focus-visible:ring-emerald-500",
            )}
            required
          />
          {confirmTouched && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                passwordsMatch ? "text-emerald-600" : "text-brand",
              )}
            >
              {passwordsMatch ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <X className="h-3.5 w-3.5" aria-hidden />
              )}
              {passwordsMatch ? "As senhas conferem." : "As senhas não conferem."}
            </p>
          )}
        </div>

        {error && <AuthError message={error} reference={errorReference} />}

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Criando conta...
            </>
          ) : (
            "Criar conta"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

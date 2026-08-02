"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { evaluatePassword } from "@rfitness/core";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthError, AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function RegisterForm() {
  const router = useRouter();
  const [gymName, setGymName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reavaliada a cada tecla; o nome/e-mail/academia entram como contexto para
  // reprovar senha derivada dos próprios dados do cadastro.
  const strength = useMemo(
    () => evaluatePassword(password, [adminName, adminEmail, gymName]),
    [password, adminName, adminEmail, gymName],
  );

  const confirmTouched = passwordConfirm.length > 0;
  const passwordsMatch = password === passwordConfirm;
  const canSubmit = strength.acceptable && passwordsMatch && confirmTouched && !loading;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

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
      // O identificador interno da academia é gerado no servidor a partir do
      // nome — não é escolha nem informação do usuário.
      await apiFetch("/auth/register-gym", {
        method: "POST",
        allowAnonymous: true,
        body: JSON.stringify({ gymName, adminName, adminEmail, adminPassword: password }),
      });

      // O cadastro cria o usuário no Auth; o login em seguida gera a sessão.
      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim().toLowerCase(),
        password,
      });
      if (authError) {
        router.replace("/login");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      wide
      title="Criar sua academia"
      subtitle="Leva menos de um minuto. Você será o administrador da conta."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-white hover:text-brand-400">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="gymName">Nome da academia</Label>
          <Input
            id="gymName"
            autoFocus
            autoComplete="organization"
            placeholder="Ex.: Bora Bill"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="adminName">Seu nome</Label>
            <Input
              id="adminName"
              autoComplete="name"
              placeholder="Nome e sobrenome"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminEmail">E-mail</Label>
            <Input
              id="adminEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@academia.com.br"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </div>
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

        {error && <AuthError message={error} />}

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Criando academia...
            </>
          ) : (
            "Criar academia"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

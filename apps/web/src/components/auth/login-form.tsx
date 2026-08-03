"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { AuthError, AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    // Login direto no Supabase Auth: a sessão é gravada em cookies pelo
    // @supabase/ssr, e é isso que as rotas /api/* leem a cada request.
    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : authError.message,
      );
      setLoading(false);
      return;
    }

    // Credencial certa não é o bastante: a conta ainda precisa estar liberada.
    // Sem esta checagem a pessoa entraria e só descobriria o bloqueio depois,
    // dentro do painel. A sessão é encerrada para não deixar meia-entrada.
    try {
      const session = await apiFetch<{ access: { status: string } | null }>("/auth/me");
      if (session.access && session.access.status !== "ACTIVE") {
        await supabase.auth.signOut();
        setError(
          session.access.status === "REJECTED"
            ? "A administração da RFitness não liberou o acesso desta conta."
            : "Sua conta ainda precisa ser liberada pela administração da RFitness. Você recebe um aviso assim que isso acontecer.",
        );
        setLoading(false);
        return;
      }
    } catch {
      // Falha ao consultar o perfil não deve barrar quem tem credencial válida:
      // o servidor recusa de novo em cada rota, e o layout do painel também.
    }

    const redirect = searchParams.get("redirect");
    const target = redirect && redirect.startsWith("/dashboard") ? redirect : "/dashboard";

    // Navegação completa, não `router.replace`. O App Router guarda em cache o
    // payload das rotas já visitadas, e ele não pertence a uma sessão — trocar
    // de conta na mesma aba servia a shell renderizada para quem estava logado
    // antes, com o menu e o painel do usuário errado. Descartar tudo é a única
    // forma de garantir que nada do login anterior sobreviva.
    window.location.assign(target);
  }

  return (
    <AuthShell
      title="Entrar na sua conta"
      subtitle="Acesse o painel da sua academia."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-white hover:text-brand-400">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="voce@academia.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <AuthError message={error} />}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

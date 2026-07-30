"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
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

    const redirect = searchParams.get("redirect");
    router.replace(redirect && redirect.startsWith("/dashboard") ? redirect : "/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 text-3xl font-black tracking-tight">
          <span className="text-brand">R</span>Fitness
        </div>
        <CardTitle>Entrar na sua conta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-brand">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/cadastro" className="font-medium text-brand hover:underline">
              Cadastrar academia
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function CadastroPage() {
  const router = useRouter();
  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch("/auth/register-gym", {
        method: "POST",
        allowAnonymous: true,
        body: JSON.stringify({
          gymName,
          gymSlug: gymSlug || slugify(gymName),
          adminName,
          adminEmail,
          adminPassword,
        }),
      });

      // O cadastro cria o usuário no Auth; o login em seguida gera a sessão.
      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
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
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <div className="mb-2 text-3xl font-black tracking-tight">
          <span className="text-brand">R</span>Fitness
        </div>
        <CardTitle>Cadastrar academia</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gymName">Nome da academia</Label>
            <Input
              id="gymName"
              value={gymName}
              onChange={(e) => {
                setGymName(e.target.value);
                setGymSlug(slugify(e.target.value));
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gymSlug">Identificador</Label>
            <Input
              id="gymSlug"
              value={gymSlug}
              onChange={(e) => setGymSlug(slugify(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground">Usado internamente. Só letras, números e hífen.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminName">Seu nome</Label>
            <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminEmail">E-mail</Label>
            <Input
              id="adminEmail"
              type="email"
              autoComplete="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminPassword">Senha</Label>
            <Input
              id="adminPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
          </div>
          {error && <p className="text-sm text-brand">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar academia"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

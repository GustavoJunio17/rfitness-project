"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { evaluatePassword } from "@rfitness/core";
import { ApiError, apiFetch } from "@/lib/api-client";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

/**
 * Conta do usuário.
 *
 * A troca de senha é o que fecha o fluxo de aprovação: o gestor entra com a
 * senha provisória gerada pela RFitness e a substitui aqui.
 */
export default function ContaPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(
    () => evaluatePassword(newPassword, [session?.name ?? "", session?.email ?? ""]),
    [newPassword, session?.name, session?.email],
  );

  const confirmTouched = confirm.length > 0;
  const passwordsMatch = newPassword === confirm;
  const canSubmit =
    currentPassword.length > 0 && strength.acceptable && passwordsMatch && confirmTouched && !loading;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setLoading(true);

    try {
      await apiFetch("/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conta</h1>
        <p className="text-sm text-muted-foreground">Seus dados de acesso à plataforma.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{session?.name}</p>
          <p className="text-muted-foreground">{session?.email}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {session?.isPlatformAdmin && <Badge>Admin da plataforma</Badge>}
            {session?.gym && <Badge variant="outline">Academia ativa: {session.gym.name}</Badge>}
            {session?.roles.map((role) => (
              <Badge key={role} variant="outline">
                {role}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nova senha</Label>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <PasswordStrengthMeter strength={strength} pristine={newPassword.length === 0} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={confirmTouched && !passwordsMatch}
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

            {error && <p className="text-sm text-brand-red">{error}</p>}
            {done && <p className="text-sm text-emerald-600">Senha alterada.</p>}

            <Button type="submit" disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Salvando...
                </>
              ) : (
                "Alterar senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

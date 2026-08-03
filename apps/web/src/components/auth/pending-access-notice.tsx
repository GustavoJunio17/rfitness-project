"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut, RefreshCw, XCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

/**
 * Tela de quem entrou mas não foi liberado.
 *
 * Vive fora do painel de propósito: quem não pode operar não deve ver o shell
 * autenticado, com menu e academia, e descobrir o bloqueio só ao clicar em algo.
 */
export function PendingAccessNotice({
  status,
  reason,
  email,
}: {
  status: "PENDING" | "REJECTED" | "SUSPENDED";
  reason: string | null;
  email: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await getSupabaseBrowserClient().auth.signOut();
    // Navegação completa para descartar o cache de rotas do App Router junto
    // com a sessão — ver `topbar.tsx`.
    window.location.assign("/login");
  }

  // Recusado e suspenso dizem a mesma coisa para quem está do lado de fora:
  // não dá para usar o painel. A diferença entre os dois é administrativa.
  const blocked = status !== "PENDING";

  return (
    <AuthShell
      title={blocked ? "Acesso não liberado" : "Conta aguardando liberação"}
      subtitle={
        blocked
          ? "A administração da RFitness não liberou o acesso desta conta."
          : "Sua conta foi criada, mas ainda precisa ser liberada pela administração da RFitness."
      }
      footer={<>Dúvidas? Fale com a administração da RFitness.</>}
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          {blocked ? (
            <XCircle className="h-10 w-10 text-brand-red" aria-hidden />
          ) : (
            <Clock className="h-10 w-10 text-amber-500" aria-hidden />
          )}
          <p className="text-sm text-muted-foreground">
            {blocked
              ? "Não é possível usar o painel com esta conta."
              : "Enquanto isso não é possível entrar no painel."}
          </p>
          <p className="text-xs text-muted-foreground">
            Conta: <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        {reason && (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <span className="font-medium">Motivo: </span>
            {reason}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {!blocked && (
            // A liberação acontece do outro lado, sem aviso para esta aba; um
            // botão explícito evita a dúvida de "será que já liberaram?".
            <Button variant="outline" className="w-full" onClick={() => router.refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Já fui liberado, verificar
            </Button>
          )}
          <Button className="w-full" onClick={handleSignOut} disabled={signingOut}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            {signingOut ? "Saindo..." : "Sair"}
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}

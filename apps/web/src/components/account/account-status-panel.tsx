"use client";

import Link from "next/link";
import { Building2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonStatCards } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: { card: "border-border", icon: "text-muted-foreground" },
} as const;

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      {children}
    </Link>
  );
}

function StatePanel({
  icon: Icon,
  tone,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg pt-8">
      <Card className={TONES[tone].card}>
        <CardContent className="space-y-4 p-8 text-center">
          <Icon className={cn("mx-auto h-10 w-10", TONES[tone].icon)} aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
          {action}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * O que aparece no lugar do painel quando a sessão é válida mas não há academia
 * ativa. Cada motivo tem uma tela própria — um painel vazio e mudo deixaria a
 * pessoa sem saber se está esperando alguém, se foi recusada ou se só falta
 * criar a primeira unidade.
 */
export function AccountStatusPanel() {
  const { data: session, isPending } = useSession();

  if (isPending) return <SkeletonStatCards count={4} />;
  if (!session) return null;

  if (session.isPlatformAdmin) {
    return (
      <StatePanel
        icon={ShieldCheck}
        tone="neutral"
        title="Console da plataforma"
        action={<ActionLink href="/dashboard/plataforma">Abrir console</ActionLink>}
      >
        <p>
          Sua conta administra a RFitness e não opera nenhuma academia. Os cadastros pendentes e a
          rede de unidades ficam no console.
        </p>
      </StatePanel>
    );
  }

  // Conta não liberada não chega aqui: o layout do painel a manda para
  // /acesso-pendente antes de renderizar qualquer coisa. Sobram os dois casos
  // de quem está liberado e sem unidade ativa.
  //
  // Sem nenhuma academia é o estado logo após a liberação, então a tela convida
  // a criar em vez de só informar que não há nada.
  const firstTime = session.memberships.length === 0;

  return (
    <StatePanel
      icon={Building2}
      tone="neutral"
      title={firstTime ? "Acesso liberado" : "Nenhuma academia selecionada"}
      action={
        <ActionLink href="/dashboard/academias?nova=1">
          {firstTime ? "Cadastrar academia" : "Ver minhas academias"}
        </ActionLink>
      }
    >
      <p>
        {firstTime
          ? "Sua conta está liberada. Cadastre sua primeira academia para começar — depois você pode adicionar quantas unidades quiser."
          : "Escolha uma unidade para gerenciar ou cadastre uma nova."}
      </p>
    </StatePanel>
  );
}

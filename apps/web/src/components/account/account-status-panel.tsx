"use client";

import Link from "next/link";
import { Building2, Clock, ShieldCheck, XCircle, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonStatCards } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

const TONES = {
  wait: { card: "border-amber-500/40 bg-amber-500/5", icon: "text-amber-500" },
  error: { card: "border-brand-red/40 bg-brand-red/5", icon: "text-brand-red" },
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

  if (session.access?.status === "PENDING") {
    return (
      <StatePanel icon={Clock} tone="wait" title="Acesso em análise">
        <p>
          Sua conta foi criada, mas ainda precisa ser liberada pela administração da RFitness. Até
          lá não é possível cadastrar academias nem operar o painel.
        </p>
        <p>
          Assim que for liberado, basta recarregar esta página — nada precisa ser refeito nem
          cadastrado de novo.
        </p>
      </StatePanel>
    );
  }

  if (session.access?.status === "REJECTED") {
    return (
      <StatePanel icon={XCircle} tone="error" title="Acesso não liberado">
        <p>A administração da RFitness não liberou o acesso para esta conta.</p>
        {session.access.decisionReason && (
          <p className="rounded-md border border-border bg-background p-3 text-left text-foreground">
            {session.access.decisionReason}
          </p>
        )}
      </StatePanel>
    );
  }

  // Liberado e ainda sem unidade: é o estado logo após a aprovação, então a
  // tela convida a criar em vez de só informar que não há nada.
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

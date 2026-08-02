import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Cadastro tem mais campos que o login e pede um cartão mais largo. */
  wide?: boolean;
}

export function AuthShell({ title, subtitle, children, footer, wide = false }: AuthShellProps) {
  return (
    <div className={wide ? "w-full max-w-md" : "w-full max-w-sm"}>
      <Link href="/" className="mb-6 flex items-center justify-center gap-2">
        <span className="text-3xl font-black tracking-tight text-white">
          <span className="text-brand">R</span>Fitness
        </span>
      </Link>

      <Card className="border-white/10 shadow-2xl shadow-black/40">
        <CardContent className="p-7">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </CardContent>
      </Card>

      <div className="mt-6 text-center text-sm text-white/60">{footer}</div>
    </div>
  );
}

/**
 * Bloco de erro do formulário: mesmo tratamento nas duas telas.
 *
 * `reference` aparece só em falha inesperada (500) e carrega a classe/código da
 * exceção. Não diz nada ao usuário final, mas é o que ele consegue copiar para
 * o suporte sem abrir o DevTools nem o log do servidor.
 */
export function AuthError({ message, reference }: { message: string; reference?: string | null }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand-600"
    >
      <p>{message}</p>
      {reference && (
        <p className="mt-1 font-mono text-xs text-brand-600/70">
          Detalhe técnico: <span className="select-all">{reference}</span>
        </p>
      )}
    </div>
  );
}

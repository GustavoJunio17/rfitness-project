import Link from "next/link";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Cadastro tem mais campos que o login e pede uma coluna mais larga. */
  wide?: boolean;
}

/**
 * Coluna do formulário no layout lateral: sem cartão, porque a própria coluna
 * já separa o formulário do painel da marca. O logo só aparece abaixo de `lg`,
 * onde o painel da esquerda não é renderizado.
 */
export function AuthShell({ title, subtitle, children, footer, wide = false }: AuthShellProps) {
  return (
    <div className={`mx-auto w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
      <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
        <span className="text-3xl font-black tracking-tight text-foreground">
          <span className="text-brand">R</span>Fitness
        </span>
      </Link>

      <div className="mb-7 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>

      {children}

      <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">{footer}</div>
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

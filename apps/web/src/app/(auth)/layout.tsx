import Link from "next/link";
import { BarChart3, Boxes, MessageCircle } from "lucide-react";

/**
 * Telas de autenticação em duas colunas: painel da marca à esquerda (só a partir
 * de `lg`, onde há largura para ele) e o formulário à direita.
 *
 * Abaixo de `lg` a coluna da marca some por inteiro — no celular ela roubaria a
 * dobra do formulário, que é a única coisa que a pessoa veio fazer aqui. O logo
 * volta dentro do próprio formulário nesse caso (ver `AuthShell`).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-black px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        {/* Brilho da marca ao fundo — decorativo, fica atrás do texto. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-[-10rem] h-[34rem] w-[34rem] rounded-full bg-brand/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-52 right-[-12rem] h-[30rem] w-[30rem] rounded-full bg-brand/10 blur-3xl"
        />

        <Link href="/" className="relative z-10 flex items-center gap-2">
          <span className="text-3xl font-black tracking-tight text-white">
            <span className="text-brand">R</span>Fitness
          </span>
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            A sua academia inteira em um só painel.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Estoque, vendas, financeiro, alunos e atendimento no WhatsApp — sem planilha solta e sem
            perder venda no balcão.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: Boxes, label: "Estoque e vendas com baixa automática" },
              { icon: BarChart3, label: "Financeiro e relatórios do mês em tempo real" },
              { icon: MessageCircle, label: "Atendimento com IA no WhatsApp" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="h-4 w-4 text-brand-400" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} RFitness. Gestão de academia.
        </p>
      </aside>

      <main className="flex items-center justify-center bg-background px-6 py-12 sm:px-10">
        <div className="w-full animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Wallet,
  ClipboardList,
  BarChart3,
  MessageCircle,
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Operação do dia a dia — só faz sentido com uma academia ativa. */
const GYM_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/alunos", label: "Alunos", icon: Users },
  { href: "/dashboard/estoque", label: "Estoque", icon: Package },
  { href: "/dashboard/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/dashboard/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/dashboard/whatsapp", label: "WhatsApp IA", icon: MessageCircle },
  { href: "/dashboard/relatorios", label: "Relatórios", icon: BarChart3 },
];

const ACCOUNT_ITEM: NavItem = { href: "/dashboard/conta", label: "Conta", icon: UserCog };
const PLATFORM_ITEM: NavItem = { href: "/dashboard/plataforma", label: "Plataforma", icon: ShieldCheck };

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-brand-red/10 text-brand-red hover:bg-brand-red/10 hover:text-brand-red",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Sem academia ativa, os links de operação levariam a telas que só sabem
  // responder erro — some com eles em vez de oferecer becos sem saída.
  const hasGym = Boolean(session?.gym);

  const groups: NavGroup[] = [];
  if (hasGym) groups.push({ label: "Academia", items: GYM_ITEMS });

  // O gestor não administra a rede: quem cadastra academia e define quem a
  // acessa é a administração da RFitness. Para ele, o seletor da topbar é o
  // conjunto fechado do que dá para operar.
  const accountItems: NavItem[] = [ACCOUNT_ITEM];
  if (session?.isPlatformAdmin) accountItems.push(PLATFORM_ITEM);
  groups.push({ label: "Conta", items: accountItems });

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-border px-6 text-xl font-black tracking-tight">
        <span className="text-brand-red">R</span>Fitness
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={
                  item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
                }
              />
            ))}
          </div>
        ))}
      </nav>

      {session?.gym && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gerenciando</p>
          <p className="truncate text-sm font-medium">{session.gym.name}</p>
        </div>
      )}
    </aside>
  );
}

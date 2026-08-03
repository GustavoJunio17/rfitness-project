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
  Building2,
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

/** Operação do dia a dia — só faz sentido com uma academia ativa. */
const GYM_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/alunos", label: "Alunos", icon: Users },
  { href: "/dashboard/estoque", label: "Estoque", icon: Package },
  { href: "/dashboard/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/dashboard/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/dashboard/whatsapp", label: "WhatsApp IA", icon: MessageCircle },
  { href: "/dashboard/relatorios", label: "Relatórios", icon: BarChart3 },
];

/** Conta e rede — disponíveis mesmo para quem ainda não tem academia. */
const ACCOUNT_ITEMS: NavItem[] = [
  { href: "/dashboard/academias", label: "Minhas academias", icon: Building2 },
  { href: "/dashboard/conta", label: "Conta", icon: UserCog },
];

const PLATFORM_ITEM: NavItem = {
  href: "/dashboard/plataforma",
  label: "Plataforma",
  icon: ShieldCheck,
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-brand-red/10 text-brand-red hover:bg-brand-red/10 hover:text-brand-red",
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Sem academia ativa, os links de operação levariam a telas que só sabem
  // responder erro — some com eles em vez de oferecer becos sem saída.
  const gymItems = session?.gym ? GYM_ITEMS : [];
  const accountItems = session?.isPlatformAdmin ? [...ACCOUNT_ITEMS, PLATFORM_ITEM] : ACCOUNT_ITEMS;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-border px-6 text-xl font-black tracking-tight">
        <span className="text-brand-red">R</span>Fitness
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {gymItems.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        {gymItems.length > 0 && <div className="my-2 border-t border-border" />}

        {accountItems.map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>
    </aside>
  );
}

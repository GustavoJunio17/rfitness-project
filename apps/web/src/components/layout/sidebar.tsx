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
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/alunos", label: "Alunos", icon: Users },
  { href: "/dashboard/estoque", label: "Estoque", icon: Package },
  { href: "/dashboard/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/dashboard/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/dashboard/whatsapp", label: "WhatsApp IA", icon: MessageCircle },
  { href: "/dashboard/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-border px-6 text-xl font-black tracking-tight">
        <span className="text-brand-red">R</span>Fitness
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-brand-red/10 text-brand-red hover:bg-brand-red/10 hover:text-brand-red",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { GymSwitcher } from "./gym-switcher";

export function Topbar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await getSupabaseBrowserClient().auth.signOut();

    // Navegação completa: `signOut` limpa os cookies, mas não o cache de rotas
    // do App Router. Sem descartá-lo, a próxima conta a entrar nesta aba
    // reencontraria as telas renderizadas para esta.
    window.location.assign("/login");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
      <div>
        <p className="text-sm font-medium">{userName}</p>
        <p className="text-xs text-muted-foreground">{userEmail}</p>
      </div>
      <div className="flex items-center gap-2">
        <GymSwitcher />
        <NotificationBell />
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={handleLogout} disabled={loading}>
          <LogOut className="mr-2 h-4 w-4" />
          {loading ? "Saindo..." : "Sair"}
        </Button>
      </div>
    </header>
  );
}

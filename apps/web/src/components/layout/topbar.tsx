"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  async function handleLogout() {
    try {
      if (refreshToken) {
        await apiFetch("/auth/logout", {
          method: "POST",
          skipAuth: true,
          body: JSON.stringify({ refreshToken }),
        });
      }
    } finally {
      clearSession();
      router.push("/login");
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6">
      <div>
        <p className="text-sm font-medium">{user?.name}</p>
        <p className="text-xs text-muted-foreground">{user?.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}

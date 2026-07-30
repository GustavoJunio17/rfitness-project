import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth/context";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";

// Shell autenticado depende de cookies de sessão — dinâmico por definição.
export const dynamic = "force-dynamic";

/**
 * Shell autenticado. Server Component: a sessão é validada no servidor antes de
 * qualquer render, então o dashboard nunca aparece para quem não tem tenant —
 * o middleware é só o atalho que evita a renderização.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login?redirect=/dashboard");

  return (
    <div className="flex min-h-screen">
      <RealtimeBridge />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar userName={auth.name} userEmail={auth.email} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}

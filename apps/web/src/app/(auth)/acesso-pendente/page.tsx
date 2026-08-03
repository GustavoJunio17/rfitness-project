import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth/context";
import { getAccountStatus } from "@/server/modules/platform/platform.service";
import { PendingAccessNotice } from "@/components/auth/pending-access-notice";

export const metadata: Metadata = {
  title: "Acesso pendente",
  description: "Sua conta aguarda liberação da administração da RFitness.",
};

// Depende da sessão (cookies): nunca deve ser pré-renderizada.
export const dynamic = "force-dynamic";

/**
 * Destino de quem tem sessão válida mas não foi liberado.
 *
 * A checagem é do servidor, e não só do cliente: é ela que garante que a pessoa
 * não alcance nada do painel, mesmo digitando a URL direto.
 */
export default async function AcessoPendentePage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  if (auth.accessStatus === "ACTIVE") redirect("/dashboard");

  const account = await getAccountStatus(auth.authUserId);

  return (
    <PendingAccessNotice
      status={auth.accessStatus}
      reason={account?.decisionReason ?? null}
      email={auth.email}
    />
  );
}

import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth/context";

// Depende da sessão (cookies): nunca deve ser pré-renderizada — sem isto o build
// tentaria avaliar a configuração de runtime e falharia sem as variáveis do
// Supabase presentes.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  redirect(auth.accessStatus === "APPROVED" ? "/dashboard" : "/acesso-pendente");
}

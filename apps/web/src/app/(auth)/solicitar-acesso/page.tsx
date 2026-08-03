import type { Metadata } from "next";
import { AccessRequestForm } from "@/components/auth/access-request-form";

export const metadata: Metadata = {
  title: "Solicitar acesso",
  description: "Peça acesso à plataforma RFitness para gerenciar sua academia.",
};

export default function SolicitarAcessoPage() {
  return <AccessRequestForm />;
}

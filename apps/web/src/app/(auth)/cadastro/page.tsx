import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Cadastre-se como gestor no RFitness. A academia é liberada pela administração.",
};

export default function CadastroPage() {
  return <SignUpForm />;
}

import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Criar academia",
  description: "Cadastre sua academia no RFitness e comece a gerenciar estoque, vendas e alunos.",
};

export default function CadastroPage() {
  return <RegisterForm />;
}

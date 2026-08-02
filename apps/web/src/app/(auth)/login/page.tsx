import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import AuthLoading from "../loading";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel da sua academia no RFitness.",
};

/**
 * `useSearchParams` (do ?redirect=) obriga um boundary de Suspense no prerender
 * do App Router; por isso o formulário vive num componente cliente separado.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <LoginForm />
    </Suspense>
  );
}

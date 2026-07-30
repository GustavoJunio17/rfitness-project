import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

/**
 * `useSearchParams` (do ?redirect=) obriga um boundary de Suspense no prerender
 * do App Router; por isso o formulário vive num componente cliente separado.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}

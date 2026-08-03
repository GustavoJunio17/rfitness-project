"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,

            // Voltar para uma tela já visitada não deve recarregar tudo: o dado
            // continua na tela enquanto a revalidação acontece por baixo, e o
            // tempo real invalida o que muda de fato.
            staleTime: 60_000,
            gcTime: 10 * 60_000,

            // Alternar de janela não é sinal de que o dado mudou — e cada volta
            // ao navegador disparava um refetch de tudo que estava montado.
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,

            // Mantém o resultado anterior visível enquanto a chave muda (filtro,
            // busca, troca de página), em vez de piscar esqueleto a cada tecla.
            placeholderData: <T,>(previous: T) => previous,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

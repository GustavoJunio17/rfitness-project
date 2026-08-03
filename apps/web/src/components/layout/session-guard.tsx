"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const RECOVERY_MARKER = "rf:session-recovery";
const RECOVERY_WINDOW_MS = 10_000;

/**
 * Se a shell renderizada pelo servidor pertence a outra conta, descarta.
 *
 * As camadas de cache já são bloqueadas por cabeçalho e configuração, mas nada
 * disso é verificável em tempo de execução: basta um proxy, uma extensão ou o
 * histórico do navegador para uma página autenticada reaparecer para a pessoa
 * errada. Esta checagem é a que fecha a conta — ela compara quem o servidor
 * pensou que estava logado com quem a sessão do Supabase diz que está, e não
 * confia em nenhuma das camadas anteriores para isso.
 *
 * Também cobre a troca de conta em outra aba: o Supabase propaga a mudança
 * entre abas, então a aba antiga se corrige sozinha em vez de continuar
 * mostrando um painel que não é mais do dono da sessão.
 */
export function SessionGuard({ expectedAuthUserId }: { expectedAuthUserId: string }) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    function recover(currentUserId: string | null) {
      // Recarregar em laço seria pior que o problema: se a divergência
      // persistir, a saída é encerrar a sessão em vez de insistir.
      const last = Number(window.sessionStorage.getItem(RECOVERY_MARKER) ?? 0);
      if (Date.now() - last < RECOVERY_WINDOW_MS) {
        window.sessionStorage.removeItem(RECOVERY_MARKER);
        void supabase.auth.signOut().finally(() => window.location.assign("/login"));
        return;
      }

      window.sessionStorage.setItem(RECOVERY_MARKER, String(Date.now()));
      // Sem sessão nenhuma não há o que recarregar: o servidor mandaria de volta
      // para o login de qualquer forma.
      window.location.assign(currentUserId ? window.location.pathname : "/login");
    }

    function check(currentUserId: string | null) {
      if (currentUserId === expectedAuthUserId) {
        window.sessionStorage.removeItem(RECOVERY_MARKER);
        return;
      }
      recover(currentUserId);
    }

    void supabase.auth.getSession().then(({ data }) => check(data.session?.user.id ?? null));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // `INITIAL_SESSION` repete o que a checagem acima já fez; `TOKEN_REFRESHED`
      // é o mesmo usuário com token novo, e recarregar aí seria recarregar a
      // aba de hora em hora sem motivo.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      check(session?.user.id ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [expectedAuthUserId]);

  return null;
}

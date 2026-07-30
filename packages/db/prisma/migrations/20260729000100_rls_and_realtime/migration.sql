-- =====================================================================
-- RLS (defesa em profundidade) + Supabase Realtime
--
-- Modelo de acesso:
--   * A aplicação fala com o banco só pelo Prisma, usando a connection string
--     do Postgres (role dono do schema, que ignora RLS). Toda autorização de
--     negócio (gymId + papéis) é aplicada no servidor, em src/server.
--   * O browser fala com o Supabase apenas via Auth e Realtime. Habilitar RLS
--     SEM policies em todas as tabelas de negócio garante que a anon key não
--     consiga ler nada direto, mesmo que alguém aponte um supabase-js para elas.
--   * A única exceção é `realtime_events`, que tem policy de SELECT escopada
--     pelo gym_id do JWT — é o canal de sinais do dashboard.
-- =====================================================================

-- ---------------------------------------------------------------------
-- gym_id do usuário autenticado, lido de app_metadata do JWT do Supabase Auth.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_gym_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'gym_id',
    current_setting('request.jwt.claims', true)::jsonb ->> 'gym_id'
  );
$$;

-- ---------------------------------------------------------------------
-- Deny-all: RLS ligado e nenhuma policy nas tabelas de negócio.
-- ---------------------------------------------------------------------
ALTER TABLE "gyms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_flow_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- realtime_events: leitura só dos sinais da própria academia.
-- ---------------------------------------------------------------------
ALTER TABLE "realtime_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_events_select_own_gym" ON "realtime_events";
CREATE POLICY "realtime_events_select_own_gym"
  ON "realtime_events"
  FOR SELECT
  TO authenticated
  USING ("gymId" = public.auth_gym_id());

-- REPLICA IDENTITY FULL faz o payload do Postgres Changes trazer a linha
-- inteira; sem isso o filtro por gymId do lado do cliente não recebe a coluna.
ALTER TABLE "realtime_events" REPLICA IDENTITY FULL;

-- Publicação do Realtime. O bloco tolera ambiente sem Supabase (Postgres cru
-- em teste local), onde a publicação não existe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'realtime_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_events;
    END IF;
  END IF;
END
$$;

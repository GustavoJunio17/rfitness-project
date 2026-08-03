-- =====================================================================
-- Plataforma RFitness + academias múltiplas por gestor
--
--  1. `platform_admins` e `access_requests`: o cadastro deixa de ser
--     self-service e passa por aprovação de um admin da plataforma.
--  2. `users.authUserId` deixa de ser único: uma pessoa vira um perfil por
--     academia, com papéis próprios em cada uma.
--  3. `gyms.ownerAuthUserId`: identifica a rede de um gestor.
--  4. A policy de `realtime_events` passa a olhar a LISTA de academias do JWT
--     em vez de um único gym_id — senão o gestor só receberia sinal de uma.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Plataforma
-- ---------------------------------------------------------------------
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_admins_authUserId_key" ON "platform_admins"("authUserId");
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "phone" TEXT,
    "gymName" TEXT NOT NULL,
    "notes" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "decisionReason" TEXT,
    "createdGymId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_requests_status_createdAt_idx" ON "access_requests"("status", "createdAt");
CREATE INDEX "access_requests_requesterEmail_idx" ON "access_requests"("requesterEmail");

ALTER TABLE "access_requests"
    ADD CONSTRAINT "access_requests_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "platform_admins"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 2. Academia dona / rede do gestor
-- ---------------------------------------------------------------------
ALTER TABLE "gyms" ADD COLUMN "ownerAuthUserId" TEXT;
CREATE INDEX "gyms_ownerAuthUserId_idx" ON "gyms"("ownerAuthUserId");

-- Base existente: o dono é quem cadastrou a academia, ou seja, o perfil mais
-- antigo dela. `DISTINCT ON` em vez de um join direto porque um join casaria
-- qualquer perfil da academia e elegeria um dono arbitrário.
UPDATE "gyms" g
SET "ownerAuthUserId" = first_user."authUserId"
FROM (
  SELECT DISTINCT ON ("gymId") "gymId", "authUserId"
  FROM "users"
  ORDER BY "gymId", "createdAt" ASC
) first_user
WHERE first_user."gymId" = g."id"
  AND g."ownerAuthUserId" IS NULL;

-- ---------------------------------------------------------------------
-- 3. Um perfil por (pessoa, academia)
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS "users_authUserId_key";
CREATE UNIQUE INDEX "users_authUserId_gymId_key" ON "users"("authUserId", "gymId");
CREATE INDEX "users_authUserId_idx" ON "users"("authUserId");

-- ---------------------------------------------------------------------
-- 4. RLS das tabelas novas: deny-all, como as demais tabelas de negócio.
--    Elas só são lidas pelo servidor, via Prisma.
-- ---------------------------------------------------------------------
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_requests" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 5. Realtime escopado pela lista de academias do usuário.
--
-- `app_metadata.gym_ids` é gravado só com service role a cada mudança de
-- vínculo. Um gestor com três unidades precisa receber sinal das três — a
-- função antiga, de um gym_id só, silenciaria as outras duas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_gym_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- O guard de jsonb_typeof não é zelo excessivo: `jsonb_array_elements_text`
  -- estoura se o claim vier como string, e o erro derruba a subscrição inteira
  -- do Realtime em vez de só não casar a linha.
  SELECT COALESCE(
    (
      SELECT ARRAY(SELECT jsonb_array_elements_text(claim))
      FROM (
        SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb
                 -> 'app_metadata' -> 'gym_ids' AS claim
      ) source
      WHERE jsonb_typeof(claim) = 'array'
    ),
    ARRAY[]::text[]
  );
$$;

DROP POLICY IF EXISTS "realtime_events_select_own_gym" ON "realtime_events";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE $policy$
      CREATE POLICY "realtime_events_select_own_gym"
        ON "realtime_events"
        FOR SELECT
        TO authenticated
        USING ("gymId" = ANY (public.auth_gym_ids()));
    $policy$;
  ELSE
    RAISE NOTICE 'Role "authenticated" ausente — policy de realtime_events não criada (ambiente sem Supabase).';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.auth_gym_id();

-- =====================================================================
-- `access_requests` vira `manager_accounts`.
--
-- A tabela deixou de ser uma fila de pedidos e passou a ser o registro de
-- quem existe na plataforma: o admin cria contas direto, e o cadastro público
-- é só mais uma origem. O nome antigo descrevia o fluxo, não a entidade.
--
-- Ganha SUSPENDED — cortar o acesso de um gestor ativo não é a mesma coisa
-- que recusar um cadastro: os vínculos e o histórico continuam de pé.
-- =====================================================================

CREATE TYPE "ManagerAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

CREATE TABLE "manager_accounts" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "status" "ManagerAccountStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manager_accounts_authUserId_key" ON "manager_accounts"("authUserId");
CREATE UNIQUE INDEX "manager_accounts_email_key" ON "manager_accounts"("email");
CREATE INDEX "manager_accounts_status_createdAt_idx" ON "manager_accounts"("status", "createdAt");

ALTER TABLE "manager_accounts"
    ADD CONSTRAINT "manager_accounts_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "platform_admins"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Migra o que existir. `APPROVED` vira `ACTIVE`; cadastros sem conta de Auth
-- (do fluxo mais antigo, em que nada era criado antes da aprovação) não têm
-- para onde ir e ficam de fora — não há credencial a que associá-los.
INSERT INTO "manager_accounts" (
  "id", "authUserId", "name", "email", "phone", "notes", "status",
  "reviewedAt", "reviewedById", "decisionReason", "createdAt", "updatedAt"
)
SELECT
  "id",
  "authUserId",
  "requesterName",
  "requesterEmail",
  "phone",
  "notes",
  CASE "status"::text
    WHEN 'APPROVED' THEN 'ACTIVE'::"ManagerAccountStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"ManagerAccountStatus"
    ELSE 'PENDING'::"ManagerAccountStatus"
  END,
  "reviewedAt",
  "reviewedById",
  "decisionReason",
  "createdAt",
  "updatedAt"
FROM "access_requests"
WHERE "authUserId" IS NOT NULL;

ALTER TABLE "manager_accounts" ENABLE ROW LEVEL SECURITY;

DROP TABLE "access_requests";
DROP TYPE "AccessRequestStatus";

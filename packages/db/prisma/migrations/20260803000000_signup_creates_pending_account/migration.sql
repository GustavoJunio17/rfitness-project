-- =====================================================================
-- Cadastro passa a criar a conta, pendente de liberação.
--
-- Antes o formulário público só registrava um interesse e a aprovação criava
-- a conta com senha provisória. Agora a pessoa escolhe a própria senha no
-- cadastro e a conta nasce junto com o pedido; o que a aprovação libera é a
-- academia. `authUserId` é o elo entre o pedido e essa conta.
-- =====================================================================

ALTER TABLE "access_requests" ADD COLUMN "authUserId" TEXT;

CREATE UNIQUE INDEX "access_requests_authUserId_key" ON "access_requests"("authUserId");

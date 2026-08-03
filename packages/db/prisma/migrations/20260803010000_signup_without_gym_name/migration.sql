-- =====================================================================
-- O cadastro deixa de perguntar a academia.
--
-- Aprovar passa a ser só liberar a conta; quem cadastra as unidades é o
-- próprio gestor, depois de liberado. `gymName` vira opcional em vez de ser
-- removida — os registros antigos guardam a academia que a aprovação
-- provisionou, e apagar isso perderia a trilha de como cada tenant nasceu.
-- =====================================================================

ALTER TABLE "access_requests" ALTER COLUMN "gymName" DROP NOT NULL;

import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Gestor liberado, mas sem nenhuma academia atribuída.
 *
 * Não oferece botão nenhum de propósito: cadastrar unidade e decidir quem a
 * acessa é da administração da RFitness. Um "criar academia" aqui prometeria
 * uma saída que o gestor não tem.
 */
export function NoGymNotice() {
  return (
    <div className="mx-auto max-w-lg pt-8">
      <Card className="border-dashed">
        <CardContent className="space-y-3 p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">Nenhuma academia liberada para você</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta está ativa, mas ainda não foi vinculada a nenhuma unidade. A administração da
            RFitness é quem concede esse acesso.
          </p>
          <p className="text-sm text-muted-foreground">
            Assim que isso acontecer, a academia aparece no seletor no topo da tela.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

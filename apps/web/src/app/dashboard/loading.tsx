import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonChart, SkeletonPageHeader, SkeletonStatCards } from "@/components/ui/skeleton";

/** Visão geral: grade de indicadores + gráfico de receita. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonStatCards count={13} />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="h-72">
          <SkeletonChart />
        </CardContent>
      </Card>
    </div>
  );
}

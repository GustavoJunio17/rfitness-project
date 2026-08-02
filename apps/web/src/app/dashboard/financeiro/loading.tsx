import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Skeleton,
  SkeletonChart,
  SkeletonForm,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function FinanceiroLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader />

      {/* Dois pares de gráficos: mais/menos vendidos, pagamentos/heatmap. */}
      {[0, 1].map((row) => (
        <div key={row} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[0, 1].map((column) => (
            <Card key={column}>
              <CardHeader>
                <Skeleton className="h-4 w-44" />
              </CardHeader>
              <CardContent className="h-64">
                <SkeletonChart bars={row === 0 ? 5 : 8} />
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent>
            <SkeletonTable rows={5} columns={5} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <SkeletonForm fields={3} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

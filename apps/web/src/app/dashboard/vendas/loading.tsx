import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonForm, SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function VendasLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-40" />
          </div>
          <SkeletonTable rows={3} columns={5} />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SkeletonForm fields={3} />
            <div className="space-y-2 border-t border-border pt-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}

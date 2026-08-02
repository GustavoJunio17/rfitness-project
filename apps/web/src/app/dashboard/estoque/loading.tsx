import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonList, SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function EstoqueLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader actions={2} />
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <SkeletonList items={2} />
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="h-10 w-full max-w-xs" />
      </div>
      <SkeletonTable rows={6} columns={6} />
    </div>
  );
}

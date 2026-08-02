import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function PedidosLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader actions={1} />
      <Skeleton className="h-10 w-full max-w-xs" />
      <SkeletonTable rows={6} columns={6} />
    </div>
  );
}

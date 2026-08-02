import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function AlunosLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader actions={2} />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="h-10 w-full max-w-xs" />
      </div>
      <SkeletonTable rows={6} columns={4} />
    </div>
  );
}

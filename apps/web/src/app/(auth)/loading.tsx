import { Skeleton, SkeletonForm } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="mx-auto w-full max-w-sm" aria-busy>
      <div className="mb-8 lg:hidden">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="mb-7 space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-60" />
      </div>
      <SkeletonForm fields={2} />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, SkeletonForm } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="w-full max-w-sm" aria-busy>
      <div className="mb-6 flex justify-center">
        <Skeleton className="h-8 w-32 bg-white/10" />
      </div>
      <Card className="border-white/10 shadow-2xl shadow-black/40">
        <CardContent className="space-y-6 p-7">
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
          <SkeletonForm fields={2} />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

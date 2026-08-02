import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonList, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function WhatsAppLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader />

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-56" />
          </div>
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="p-2">
            <SkeletonList items={5} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <SkeletonList items={4} withAvatar />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { SkeletonPageHeader, SkeletonText } from "@/components/ui/skeleton";

export default function RelatoriosLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader />
      <div className="rounded-lg border border-dashed border-border p-12">
        <SkeletonText lines={2} className="mx-auto max-w-sm" />
      </div>
    </div>
  );
}

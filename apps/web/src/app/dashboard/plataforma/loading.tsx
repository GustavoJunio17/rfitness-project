import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from "@/components/ui/skeleton";

export default function PlataformaLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={4} columns={5} />
    </div>
  );
}

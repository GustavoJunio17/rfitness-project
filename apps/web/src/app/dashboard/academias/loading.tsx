import { SkeletonList, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function AcademiasLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <SkeletonPageHeader actions={1} />
      <SkeletonList items={3} />
    </div>
  );
}

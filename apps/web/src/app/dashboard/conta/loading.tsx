import { SkeletonForm, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function ContaLoading() {
  return (
    <div className="max-w-xl space-y-6" aria-busy>
      <SkeletonPageHeader />
      <SkeletonForm fields={3} />
    </div>
  );
}

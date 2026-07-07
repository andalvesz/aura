import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { OpportunitiesView } from "@/components/dashboard/modules/opportunities-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function OpportunitiesPage() {
  const mod = getModule("opportunities");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <OpportunitiesView />
      </Suspense>
    </div>
  );
}

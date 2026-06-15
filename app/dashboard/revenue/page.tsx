import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { RevenueView } from "@/components/dashboard/modules/revenue-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function RevenuePage() {
  const mod = getModule("revenue");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <RevenueView />
      </Suspense>
    </div>
  );
}

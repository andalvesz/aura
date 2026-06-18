import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { MasterFlowView } from "@/components/dashboard/modules/master-flow-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function MasterFlowPage() {
  const mod = getModule("master-flow");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <MasterFlowView />
      </Suspense>
    </div>
  );
}

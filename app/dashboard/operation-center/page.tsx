import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { OperationCenterView } from "@/components/dashboard/modules/operation-center-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function OperationCenterPage() {
  const mod = getModule("operation-center");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <OperationCenterView />
      </Suspense>
    </div>
  );
}

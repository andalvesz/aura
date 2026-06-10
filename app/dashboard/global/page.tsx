import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { GlobalIntelligenceView } from "@/components/dashboard/modules/global-intelligence-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function GlobalPage() {
  const mod = getModule("global");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <GlobalIntelligenceView />
      </Suspense>
    </div>
  );
}

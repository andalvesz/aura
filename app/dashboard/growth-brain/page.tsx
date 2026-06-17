import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { GrowthBrainView } from "@/components/dashboard/modules/growth-brain-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function GrowthBrainPage() {
  const mod = getModule("growth-brain");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <GrowthBrainView />
      </Suspense>
    </div>
  );
}

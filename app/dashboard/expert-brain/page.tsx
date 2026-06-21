import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ExpertBrainView } from "@/components/dashboard/modules/expert-brain-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function ExpertBrainPage() {
  const mod = getModule("expert-brain");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ExpertBrainView />
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ExcellenceView } from "@/components/dashboard/modules/excellence-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function ExcellencePage() {
  const mod = getModule("excellence");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ExcellenceView />
      </Suspense>
    </div>
  );
}

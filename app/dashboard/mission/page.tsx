import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { MissionControlView } from "@/components/dashboard/modules/mission-control-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function MissionControlPage() {
  const mod = getModule("mission");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <MissionControlView />
      </Suspense>
    </div>
  );
}

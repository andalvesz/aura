import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { SmartLaunchView } from "@/components/dashboard/modules/smart-launch-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function SmartLaunchPage() {
  const mod = getModule("smart-launch");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <SmartLaunchView />
      </Suspense>
    </div>
  );
}

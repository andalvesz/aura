import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { PlatformsView } from "@/components/dashboard/modules/platforms-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function PlatformsPage() {
  const mod = getModule("platforms");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <PlatformsView />
      </Suspense>
    </div>
  );
}

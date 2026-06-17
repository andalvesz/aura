import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { AdsCommanderView } from "@/components/dashboard/modules/ads-commander-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function AdsCommanderPage() {
  const mod = getModule("ads-commander");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <AdsCommanderView />
      </Suspense>
    </div>
  );
}

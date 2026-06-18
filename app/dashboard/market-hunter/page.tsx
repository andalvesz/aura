import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { MarketHunterView } from "@/components/dashboard/modules/market-hunter-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function MarketHunterPage() {
  const mod = getModule("market-hunter");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <MarketHunterView />
      </Suspense>
    </div>
  );
}

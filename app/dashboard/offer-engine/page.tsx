import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { OfferEngineView } from "@/components/dashboard/modules/offer-engine-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function OfferEnginePage() {
  const mod = getModule("offer-engine");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <OfferEngineView />
      </Suspense>
    </div>
  );
}

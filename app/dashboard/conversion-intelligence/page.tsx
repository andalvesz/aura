import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ConversionIntelligenceView } from "@/components/dashboard/modules/conversion-intelligence-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function ConversionIntelligencePage() {
  const mod = getModule("conversion-intelligence");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ConversionIntelligenceView />
      </Suspense>
    </div>
  );
}

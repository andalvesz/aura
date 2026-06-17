import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { RevenueAiView } from "@/components/dashboard/modules/revenue-ai-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function RevenueAiPage() {
  const mod = getModule("revenue-ai");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <RevenueAiView />
      </Suspense>
    </div>
  );
}

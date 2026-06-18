import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { FunnelPagesView } from "@/components/dashboard/modules/funnel-pages-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function FunnelPagesPage() {
  const mod = getModule("funnel-pages");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <FunnelPagesView />
      </Suspense>
    </div>
  );
}

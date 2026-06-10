import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { IntegrationsView } from "@/components/dashboard/modules/integrations-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function IntegrationsPage() {
  const mod = getModule("integrations");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <IntegrationsView />
      </Suspense>
    </div>
  );
}

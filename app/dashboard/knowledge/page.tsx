import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { KnowledgeConnectView } from "@/components/dashboard/modules/knowledge-connect-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function KnowledgePage() {
  const mod = getModule("knowledge");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <KnowledgeConnectView />
      </Suspense>
    </div>
  );
}

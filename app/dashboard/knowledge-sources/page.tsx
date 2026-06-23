import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { KnowledgeSourcesView } from "@/components/dashboard/modules/knowledge-sources-view";
import { getModule } from "@/lib/modules";

export default function KnowledgeSourcesPage() {
  const module = getModule("knowledge-sources");

  return (
    <>
      <ModuleHeader module={module} />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <KnowledgeSourcesView />
      </Suspense>
    </>
  );
}

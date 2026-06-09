import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreatorSubNav } from "@/components/dashboard/modules/creator-sub-nav";
import { ResearchView } from "@/components/dashboard/modules/research-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CreatorResearchPage() {
  const mod = getModule("creator");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Market Research",
          description: "Valide oportunidades de mercado antes de criar produtos no Creator.",
        }}
      />
      <CreatorSubNav />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ResearchView />
      </Suspense>
    </div>
  );
}

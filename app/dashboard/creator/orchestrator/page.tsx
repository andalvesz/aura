import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreatorSubNav } from "@/components/dashboard/modules/creator-sub-nav";
import { CampaignOrchestratorView } from "@/components/dashboard/modules/campaign-orchestrator-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CreatorOrchestratorPage() {
  const mod = getModule("creator");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Campaign Orchestrator",
          description:
            "Transforme um produto em campanha pronta para lançamento — conecta todos os módulos Creator.",
        }}
      />
      <CreatorSubNav />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <CampaignOrchestratorView />
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreatorSubNav } from "@/components/dashboard/modules/creator-sub-nav";
import { AutopilotView } from "@/components/dashboard/modules/autopilot-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CreatorAutopilotPage() {
  const mod = getModule("creator");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Autopilot Controlado",
          description:
            "Monitore campanhas, detecte problemas e execute apenas ações seguras com regras aprovadas.",
        }}
      />
      <CreatorSubNav />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <AutopilotView />
      </Suspense>
    </div>
  );
}

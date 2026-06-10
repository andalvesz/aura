import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { AutopilotView } from "@/components/dashboard/modules/autopilot-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function AutopilotPage() {
  const mod = getModule("autopilot");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Autopilot Controlado",
          description:
            "Monitore campanhas, tome decisões seguras e peça aprovação para ações sensíveis.",
        }}
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <AutopilotView />
      </Suspense>
    </div>
  );
}

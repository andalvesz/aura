import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { PerformanceView } from "@/components/dashboard/modules/performance-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function PerformancePage() {
  const mod = getModule("performance");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Performance AI",
          description:
            "Analise resultados cross-module e tome decisões estratégicas com IA executiva.",
        }}
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <PerformanceView />
      </Suspense>
    </div>
  );
}

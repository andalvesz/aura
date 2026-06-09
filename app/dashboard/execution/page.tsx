import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ExecutionView } from "@/components/dashboard/modules/execution-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function ExecutionPage() {
  const mod = getModule("execution");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Execution Engine",
          description:
            "Transforme planos da Aura em tarefas executáveis com prioridade, impacto, ROI e energia.",
        }}
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ExecutionView />
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { DecisionEngineView } from "@/components/dashboard/modules/decision-engine-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";

export default function DecisionEnginePage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Decision Engine</h1>
        <p className="text-[12px] text-zinc-500">
          Visibilidade das decisões unificadas — score, motivo e fontes
        </p>
      </div>
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <DecisionEngineView />
      </Suspense>
    </div>
  );
}

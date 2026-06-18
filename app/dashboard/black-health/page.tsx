import { Suspense } from "react";
import { BlackHealthView } from "@/components/dashboard/modules/black-health-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";

export default function BlackHealthPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Black Health</h1>
        <p className="text-[12px] text-zinc-500">
          Observabilidade dos módulos Aura Black — feeds, syncs e decisões
        </p>
      </div>
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <BlackHealthView />
      </Suspense>
    </div>
  );
}

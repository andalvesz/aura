import { Suspense } from "react";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { ExpertInfluenceView } from "@/components/dashboard/modules/expert-influence-view";

export default function ExpertInfluencePage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Expert Influence Audit</h1>
        <p className="text-[12px] text-zinc-500">
          Quanto do Expert Brain está sendo utilizado nas gerações da plataforma.
        </p>
      </div>
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <ExpertInfluenceView />
      </Suspense>
    </div>
  );
}

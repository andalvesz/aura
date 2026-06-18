import { Suspense } from "react";
import { FeedInspectorView } from "@/components/dashboard/modules/feed-inspector-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";

export default function FeedInspectorPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Feed Inspector</h1>
        <p className="text-[12px] text-zinc-500">
          Auditoria visual de feeds — source, entity, idempotency_key e action
        </p>
      </div>
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <FeedInspectorView />
      </Suspense>
    </div>
  );
}

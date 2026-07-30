import { Suspense } from "react";
import { DiscoveryAuraView } from "@/components/dashboard/discovery/discovery-aura-view";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const confidence = pick("confidence");
  const minConfidence = confidence ? Number(confidence) : null;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Suspense fallback={<p className="text-[12px] text-zinc-600">Carregando Discovery…</p>}>
        <DiscoveryAuraView
          selectedId={pick("id") ?? null}
          typeFilter={pick("type") ?? null}
          statusFilter={pick("status") ?? null}
          minConfidence={
            minConfidence != null && !Number.isNaN(minConfidence)
              ? minConfidence
              : null
          }
          periodFrom={pick("from") ?? null}
          periodTo={pick("to") ?? null}
          searchQuery={pick("q") ?? null}
        />
      </Suspense>
    </div>
  );
}

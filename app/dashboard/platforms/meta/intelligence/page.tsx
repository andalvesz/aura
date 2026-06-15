import Link from "next/link";
import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { MetaIntelligenceView } from "@/components/dashboard/modules/meta-intelligence-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function PlatformsMetaIntelligencePage() {
  const mod = getModule("platforms");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Meta Intelligence",
          description:
            "Inteligência de marketing com dados reais da Meta — métricas, Performance AI, Revenue Center e Autopilot.",
        }}
      />
      <nav className="flex gap-2 text-[11px]">
        <Link href="/dashboard/platforms" className="text-zinc-500 hover:text-zinc-300">
          Platform Hub
        </Link>
        <span className="text-zinc-600">/</span>
        <Link href="/dashboard/platforms/meta" className="text-zinc-500 hover:text-zinc-300">
          Meta
        </Link>
        <span className="text-zinc-600">/</span>
        <span className="text-sky-300">Intelligence</span>
      </nav>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <MetaIntelligenceView />
      </Suspense>
    </div>
  );
}

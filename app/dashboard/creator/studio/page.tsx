import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreatorSubNav } from "@/components/dashboard/modules/creator-sub-nav";
import { CreativeStudioView } from "@/components/dashboard/modules/creative-studio-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CreatorStudioPage() {
  const mod = getModule("creator");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Creative Studio",
          description:
            "Gere criativos, roteiros, carrosséis, thumbnails e todos os ativos visuais do produto.",
        }}
      />
      <CreatorSubNav />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <CreativeStudioView />
      </Suspense>
    </div>
  );
}

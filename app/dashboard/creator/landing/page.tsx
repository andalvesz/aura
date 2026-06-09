import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreatorSubNav } from "@/components/dashboard/modules/creator-sub-nav";
import { LandingBuilderView } from "@/components/dashboard/modules/landing-builder-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CreatorLandingPage() {
  const mod = getModule("creator");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Landing Builder",
          description:
            "Gere páginas de vendas completas com hero, benefícios, FAQ, depoimentos e CTA.",
        }}
      />
      <CreatorSubNav />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <LandingBuilderView />
      </Suspense>
    </div>
  );
}

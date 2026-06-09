import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CeoView } from "@/components/dashboard/modules/ceo-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CeoPage() {
  const mod = getModule("ceo");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura CEO",
          description:
            "Inteligência central da Aura — estratégias e planos de ação integrando todos os módulos.",
        }}
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <CeoView />
      </Suspense>
    </div>
  );
}

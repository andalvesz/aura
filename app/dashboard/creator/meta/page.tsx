import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreatorSubNav } from "@/components/dashboard/modules/creator-sub-nav";
import { MetaConnectView } from "@/components/dashboard/modules/meta-connect-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CreatorMetaPage() {
  const mod = getModule("creator");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Meta Ads Connect",
          description:
            "Conecte Meta Business com controle manual, campanhas pausadas por padrão e logs de segurança.",
        }}
      />
      <CreatorSubNav />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <MetaConnectView />
      </Suspense>
    </div>
  );
}

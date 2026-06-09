import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { MoneyView } from "@/components/dashboard/modules/money-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function MoneyPage() {
  const mod = getModule("money");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Aura Money Missions",
          description:
            "Transforme metas financeiras em planos executáveis com IA — integrando todos os módulos da Aura.",
        }}
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <MoneyView />
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ComunicacaoView } from "@/components/dashboard/modules/comunicacao-view";
import { getModule } from "@/lib/modules";

export default function ComunicacaoPage() {
  const mod = getModule("comunicacao");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={null}>
        <ComunicacaoView />
      </Suspense>
    </div>
  );
}

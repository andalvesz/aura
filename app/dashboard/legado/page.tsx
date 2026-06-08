import { ModuleHeader } from "@/components/dashboard/module-header";
import { LegadoView } from "@/components/dashboard/modules/legado-view";
import { getModule } from "@/lib/modules";

export default function LegadoPage() {
  const mod = getModule("legado");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <LegadoView />
    </div>
  );
}

import { ModuleHeader } from "@/components/dashboard/module-header";
import { ViagensView } from "@/components/dashboard/modules/viagens-view";
import { getModule } from "@/lib/modules";

export default function ViagensPage() {
  const mod = getModule("viagens");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <ViagensView />
    </div>
  );
}

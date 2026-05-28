import { ModuleHeader } from "@/components/dashboard/module-header";
import { CalendarioView } from "@/components/dashboard/modules/calendario-view";
import { getModule } from "@/lib/modules";

export default function CalendarioPage() {
  const mod = getModule("calendario");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <CalendarioView />
    </div>
  );
}

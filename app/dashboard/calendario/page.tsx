import { ModuleHeader } from "@/components/dashboard/module-header";
import { CalendarioErrorBoundary } from "@/components/dashboard/modules/calendario-error-boundary";
import { CalendarioView } from "@/components/dashboard/modules/calendario-view";
import { getModule } from "@/lib/modules";

export default function CalendarioPage() {
  const mod = getModule("calendario");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <CalendarioErrorBoundary>
        <CalendarioView />
      </CalendarioErrorBoundary>
    </div>
  );
}

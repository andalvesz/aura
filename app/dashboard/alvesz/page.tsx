import { ModuleHeader } from "@/components/dashboard/module-header";
import { AlveszView } from "@/components/dashboard/modules/alvesz-view";
import { getModule } from "@/lib/modules";
export default function AlveszPage() {
  const mod = getModule("alvesz");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <AlveszView />
    </div>
  );
}

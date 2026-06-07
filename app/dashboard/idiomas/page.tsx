import { ModuleHeader } from "@/components/dashboard/module-header";
import { IdiomasView } from "@/components/dashboard/modules/idiomas-view";
import { getModule } from "@/lib/modules";

export default function IdiomasPage() {
  const mod = getModule("idiomas");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <IdiomasView />
    </div>
  );
}

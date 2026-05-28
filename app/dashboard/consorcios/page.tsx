import { ModuleHeader } from "@/components/dashboard/module-header";
import { ConsorciosView } from "@/components/dashboard/modules/consorcios-view";
import { getModule } from "@/lib/modules";
export default function ConsorciosPage() {
  const mod = getModule("consorcios");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <ConsorciosView />
    </div>
  );
}

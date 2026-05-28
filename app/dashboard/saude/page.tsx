import { ModuleHeader } from "@/components/dashboard/module-header";
import { SaudeView } from "@/components/dashboard/modules/saude-view";
import { getModule } from "@/lib/modules";

export default function SaudePage() {
  const mod = getModule("saude");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <SaudeView />
    </div>
  );
}

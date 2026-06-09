import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreatorView } from "@/components/dashboard/modules/creator-view";
import { getModule } from "@/lib/modules";

export default function CreatorPage() {
  const mod = getModule("creator");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <CreatorView />
    </div>
  );
}

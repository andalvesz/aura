import { ModuleHeader } from "@/components/dashboard/module-header";
import { DisneyNbaView } from "@/components/dashboard/modules/disney-nba-view";
import { getModule } from "@/lib/modules";

export default function DisneyNbaPage() {
  const mod = getModule("disney-nba");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <DisneyNbaView />
    </div>
  );
}

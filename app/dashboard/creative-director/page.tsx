import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { CreativeDirectorView } from "@/components/dashboard/modules/creative-director-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function CreativeDirectorPage() {
  const mod = getModule("creative-director");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <CreativeDirectorView />
      </Suspense>
    </div>
  );
}

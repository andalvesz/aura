import { ModuleHeader } from "@/components/dashboard/module-header";
import { AuraMentor } from "@/components/dashboard/modules/aura-mentor";
import { CrescimentoView } from "@/components/dashboard/modules/crescimento-view";
import { getModule } from "@/lib/modules";

export default function CrescimentoPage() {
  const mod = getModule("crescimento");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <AuraMentor />
      <CrescimentoView />
    </div>
  );
}

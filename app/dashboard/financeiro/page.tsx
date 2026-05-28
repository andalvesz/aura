import { ModuleHeader } from "@/components/dashboard/module-header";
import { FinanceiroView } from "@/components/dashboard/modules/financeiro-view";
import { getModule } from "@/lib/modules";
export default function FinanceiroPage() {
  const mod = getModule("financeiro");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <FinanceiroView />
    </div>
  );
}

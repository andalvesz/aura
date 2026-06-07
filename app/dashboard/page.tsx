import { AuraCentral } from "@/components/dashboard/aura-central";
import { AuraXpPanel } from "@/components/dashboard/aura-xp-panel";
import { DailyOperationsPanel } from "@/components/dashboard/daily-operations-panel";
import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <AuraXpPanel />
      <DailyOperationsPanel />
      <ExecutiveDashboardView />
      <AuraCentral />
    </div>
  );
}
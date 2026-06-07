import { AuraCentral } from "@/components/dashboard/aura-central";
import { DailyOperationsPanel } from "@/components/dashboard/daily-operations-panel";
import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <DailyOperationsPanel />
      <ExecutiveDashboardView />
      <AuraCentral />
    </div>
  );
}
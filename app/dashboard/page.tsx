import { AuraCentral } from "@/components/dashboard/aura-central";
import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <ExecutiveDashboardView />
      <AuraCentral />
    </div>
  );
}
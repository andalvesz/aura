import { AuraChat } from "@/components/dashboard/aura-chat";
import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <ExecutiveDashboardView />
      <AuraChat />
    </div>
  );
}
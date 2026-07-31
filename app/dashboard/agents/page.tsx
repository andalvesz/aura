import {
  listAgentSessions,
  listAvailableAgents,
} from "@/lib/supabase/services/agent-runtime.service";
import { AgentCenterClient } from "@/components/dashboard/agents/agent-center-client";

export default async function AgentsPage() {
  const agents = await listAvailableAgents();
  const { items } = await listAgentSessions({ limit: 100 });

  return (
    <div className="mx-auto max-w-3xl p-4">
      <AgentCenterClient agents={agents} sessions={items} />
    </div>
  );
}

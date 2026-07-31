import { notFound } from "next/navigation";
import {
  explainAgentSession,
  getAgentSession,
} from "@/lib/supabase/services/agent-runtime.service";
import { AgentSessionViewClient } from "@/components/dashboard/agents/agent-session-view-client";

export default async function AgentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, steps, audits } = await getAgentSession(sessionId);
  if (!session) notFound();
  const { explanation } = await explainAgentSession(sessionId);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <AgentSessionViewClient
        session={session}
        steps={steps}
        audits={audits}
        explanation={explanation}
      />
    </div>
  );
}

import { BrainConversationClient } from "@/components/dashboard/conversation/brain-conversation-client";
import { listConversations } from "@/lib/supabase/services/conversation.service";

export default async function BrainPage() {
  let initial: Awaited<ReturnType<typeof listConversations>>["items"] = [];
  try {
    const res = await listConversations();
    initial = res.items.slice(0, 20);
  } catch {
    initial = [];
  }

  return (
    <div data-testid="dashboard-brain-page">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h1 className="text-lg font-medium text-zinc-100">Aura Brain</h1>
        <p className="text-[12px] text-zinc-500">
          Conversational Command Center — consulta, navegação e rascunhos com
          confirmação explícita.
        </p>
      </div>
      <BrainConversationClient initialConversations={initial} />
    </div>
  );
}

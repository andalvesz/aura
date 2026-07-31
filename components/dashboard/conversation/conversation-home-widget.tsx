import Link from "next/link";
import { getHomeConversationWidget } from "@/lib/supabase/services/conversation.service";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

export async function ConversationHomeWidget() {
  let widget: Awaited<ReturnType<typeof getHomeConversationWidget>> = {
    recent: [],
    pendingConfirmations: [],
    preparedDrafts: [],
  };
  try {
    widget = await getHomeConversationWidget();
  } catch {
    /* ignore */
  }

  return (
    <section className="space-y-2" data-testid="home-conversation-block">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-zinc-200">Conversas</h2>
        <div className="flex gap-2 text-[11px]">
          <Link
            href="/dashboard/brain"
            className="rounded border border-cyan-500/30 px-2 py-1 text-cyan-100"
          >
            Perguntar ao Aura
          </Link>
          {widget.recent[0] ? (
            <Link
              href="/dashboard/brain"
              className="rounded border border-white/10 px-2 py-1 text-zinc-400"
            >
              Continuar conversa
            </Link>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardCard
          title="Conversas recentes"
          status={widget.recent.length ? "ok" : "empty"}
          emptyTitle="Nenhuma conversa"
          emptyDescription="Abra o Command Center."
          href="/dashboard/brain"
          testId="home-conversations-recent"
        >
          <ul className="space-y-1 text-[12px]">
            {widget.recent.map((c) => (
              <li key={c.id}>
                <Link
                  href="/dashboard/brain"
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Confirmações pendentes"
          status={widget.pendingConfirmations.length ? "ok" : "empty"}
          emptyTitle="Nada pendente"
          emptyDescription="Propostas da conversa aparecem aqui."
          href="/dashboard/brain"
          testId="home-conversations-pending"
        >
          <ul className="space-y-1 text-[12px]">
            {widget.pendingConfirmations.map((p) => (
              <li key={p.id} className="text-amber-100/90">
                {p.title}
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Drafts preparados"
          status={widget.preparedDrafts.length ? "ok" : "empty"}
          emptyTitle="Sem drafts"
          emptyDescription="Rascunhos da conversa aparecem aqui."
          href="/dashboard/brain"
          testId="home-conversations-drafts"
        >
          <ul className="space-y-1 text-[12px]">
            {widget.preparedDrafts.map((d) => (
              <li key={d.id} className="text-zinc-300">
                {d.title}
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>
    </section>
  );
}

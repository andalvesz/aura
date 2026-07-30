import Link from "next/link";
import { listActivities } from "@/lib/supabase/services/daily-ops.service";
import { EmptyState } from "@/components/dashboard/empty-state";

export async function RecentActivityPanel({ limit = 12 }: { limit?: number }) {
  const items = await listActivities(limit);

  return (
    <section className="space-y-2" data-testid="recent-activity-panel">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Atividade recente
          </p>
          <p className="text-[12px] text-zinc-500">Quem · quando · o quê</p>
        </div>
        <Link
          href="/dashboard/feed"
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Ver feed
        </Link>
      </div>
      {!items.length ? (
        <EmptyState
          title="Sem atividade ainda"
          description="Capture uma memória para começar o histórico do dia."
        />
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li
              key={a.id}
              className="rounded border border-white/[0.04] px-2 py-1.5 text-[12px]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {a.href ? (
                  <Link
                    href={a.href}
                    className="text-zinc-200 hover:text-cyan-300"
                  >
                    {a.title}
                  </Link>
                ) : (
                  <span className="text-zinc-200">{a.title}</span>
                )}
                <span className="text-[10px] text-zinc-600">
                  {new Date(a.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-[10px] text-zinc-600">
                {a.activityType} · ator {a.actorUserId.slice(0, 8)}… ·{" "}
                {a.workspaceId ? "workspace" : "pessoal"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

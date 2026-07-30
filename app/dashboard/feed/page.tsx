import Link from "next/link";
import { listFeed, listFavorites } from "@/lib/supabase/services/daily-ops.service";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { EmptyState } from "@/components/dashboard/empty-state";
import { filterFavoritesByPin } from "@/lib/smart-capture/pins";

const KIND_LABEL: Record<string, string> = {
  memory: "Memória",
  discovery: "Descoberta",
  feedback: "Feedback",
  comment: "Comentário",
  archive: "Arquivamento",
  confirm: "Confirmação",
};

export default async function FeedPage() {
  const items = await listFeed(60);
  let feedPins: Awaited<ReturnType<typeof listFavorites>> = [];
  try {
    feedPins = filterFavoritesByPin(await listFavorites(), "feed");
  } catch {
    feedPins = [];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="feed-page">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Feed" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Feed do Workspace</h1>
        <p className="text-[12px] text-zinc-500">
          Atividade cronológica respeitando visibilidade e RLS.
        </p>
      </div>
      {feedPins.length ? (
        <div className="flex flex-wrap gap-2" data-testid="feed-pinned">
          {feedPins.map((p) => (
            <Link
              key={p.id}
              href={p.href}
              className="inline-flex min-h-11 items-center rounded border border-amber-500/30 px-2.5 text-[11px] text-amber-100/90 md:min-h-0 md:py-1"
            >
              {p.title}
            </Link>
          ))}
        </div>
      ) : null}
      {!items.length ? (
        <EmptyState
          title="Feed vazio"
          description="Registre uma memória ou atualize descobertas para ver atividade aqui."
        />
      ) : (
        <ol className="space-y-2 border-l border-white/10 pl-3">
          {items.map((item) => (
            <li key={item.id} className="relative text-[12px]" data-testid="feed-item">
              <span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-cyan-700/80" />
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                {KIND_LABEL[item.kind] ?? item.kind} ·{" "}
                {item.workspaceId ? "workspace" : "pessoal"} ·{" "}
                {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
              <Link
                href={item.href}
                className="text-zinc-200 hover:text-cyan-300 hover:underline"
              >
                {item.title}
              </Link>
              {item.summary ? (
                <p className="text-[11px] text-zinc-500">{item.summary}</p>
              ) : null}
              <p className="text-[10px] text-zinc-600">
                ator: {item.actorUserId.slice(0, 8)}…
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

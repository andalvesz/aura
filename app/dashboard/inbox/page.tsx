import Link from "next/link";
import { InboxClient } from "@/components/dashboard/daily/inbox-client";
import { listInboxItems } from "@/lib/supabase/services/daily-ops.service";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.filter;
  const filter =
    (Array.isArray(raw) ? raw[0] : raw) ?? "all";
  const allowed = ["unclassified", "pending_review", "recent", "all"] as const;
  const f = allowed.includes(filter as (typeof allowed)[number])
    ? (filter as (typeof allowed)[number])
    : "all";

  const items = await listInboxItems(f);

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="inbox-page">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Inbox" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Inbox</h1>
        <p className="text-[12px] text-zinc-500">
          Memórias recém-capturadas aguardando classificação. O Aura não executa
          decisões.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {(
          [
            ["all", "Todas"],
            ["unclassified", "Não classificadas"],
            ["pending_review", "Aguardando revisão"],
            ["recent", "Recentes"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/dashboard/inbox?filter=${key}`}
            className={`rounded border px-2 py-1 ${
              f === key
                ? "border-cyan-500/40 text-cyan-200"
                : "border-white/10 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <InboxClient items={items} filter={f} />
    </div>
  );
}

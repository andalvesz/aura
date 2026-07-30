"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DiscoveryTimelineEntry } from "@/lib/discovery/types";
import { filterTimelineByPeriod } from "@/lib/daily/engine";

const KIND_LABEL: Record<DiscoveryTimelineEntry["kind"], string> = {
  memory: "Memory",
  promotion: "Promotion",
  world: "World",
  insight: "Insight",
  discovery: "Discovery",
};

export function DiscoveryTimeline({
  entries,
}: {
  entries: DiscoveryTimelineEntry[];
}) {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">(
    "all"
  );
  const [kind, setKind] = useState<string>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let items = filterTimelineByPeriod(
      entries.map((e) => ({ ...e, createdAt: e.at })),
      period
    );
    if (kind !== "all") {
      items = items.filter((e) => e.kind === kind);
    }
    if (q.trim().length >= 2) {
      const needle = q.toLowerCase();
      items = items.filter(
        (e) =>
          e.title.toLowerCase().includes(needle) ||
          e.summary.toLowerCase().includes(needle)
      );
    }
    return items;
  }, [entries, period, kind, q]);

  return (
    <section data-testid="discovery-timeline">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[13px] font-medium text-zinc-300">
          Timeline unificada
        </h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar na timeline…"
          className="rounded border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200"
          data-testid="timeline-search"
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
        {(
          [
            ["all", "Tudo"],
            ["today", "Hoje"],
            ["week", "Semana"],
            ["month", "Mês"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPeriod(k)}
            className={`rounded border px-2 py-0.5 ${
              period === k
                ? "border-cyan-500/40 text-cyan-200"
                : "border-white/10 text-zinc-500"
            }`}
          >
            {label}
          </button>
        ))}
        {(
          ["all", "memory", "world", "insight", "discovery"] as const
        ).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded border px-2 py-0.5 ${
              kind === k
                ? "border-violet-500/40 text-violet-200"
                : "border-white/10 text-zinc-500"
            }`}
          >
            {k === "all" ? "tipo" : k}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-[12px] text-zinc-600">
          Sem eventos neste filtro. Registre uma memória ou atualize descobertas.
        </p>
      ) : (
        <ol className="space-y-2 border-l border-white/10 pl-3">
          {filtered.map((e) => (
            <li key={e.id} className="relative text-[12px]">
              <span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-zinc-600" />
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                {KIND_LABEL[e.kind]}
                {e.layer ? ` · camada ${e.layer}` : null}
                {e.origin ? ` · ${e.origin}` : null}
                {e.workspaceId ? ` · ws` : " · pessoal"}
                {" · "}
                {new Date(e.at).toLocaleString("pt-BR")}
              </p>
              {e.actorUserId ? (
                <p className="text-[10px] text-zinc-600">
                  ator: {e.actorUserId.slice(0, 8)}…
                </p>
              ) : null}
              <Link
                href={e.href}
                className="text-zinc-200 hover:text-cyan-300 hover:underline"
              >
                {e.title}
              </Link>
              {e.summary ? (
                <p className="text-[11px] text-zinc-500">
                  {e.summary.slice(0, 120)}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

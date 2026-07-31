"use client";

import Link from "next/link";
import type { TimelineEntry } from "@/lib/orchestrator/types";

export function GlobalTimelinePanel({
  entries,
  title = "Timeline global",
}: {
  entries: TimelineEntry[];
  title?: string;
}) {
  return (
    <div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
      data-testid="aura-global-timeline"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {title}
        </p>
        <Link
          href="/dashboard/discovery"
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Ver discovery →
        </Link>
      </div>
      {!entries.length ? (
        <p className="text-[12px] text-zinc-600">Sem eventos recentes.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={e.href}
                  className="block truncate text-[12px] text-zinc-200 hover:text-cyan-300"
                >
                  {e.title}
                </Link>
                <p className="text-[10px] text-zinc-600">
                  {e.source}
                  {e.summary ? ` · ${e.summary}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-zinc-600">
                {e.at.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

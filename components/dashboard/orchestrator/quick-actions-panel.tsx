"use client";

import Link from "next/link";
import type { QuickAction } from "@/lib/orchestrator/types";

export function QuickActionsPanel({
  actions,
}: {
  actions: QuickAction[];
}) {
  if (!actions.length) return null;
  return (
    <div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
      data-testid="aura-quick-actions"
    >
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Ações rápidas
      </p>
      <ul className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <li key={a.id}>
            <Link
              href={a.href}
              className="inline-flex min-h-11 items-center rounded border border-cyan-500/25 px-2.5 py-1.5 text-[12px] text-cyan-100 hover:border-cyan-400/40 md:min-h-0"
            >
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

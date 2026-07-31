"use client";

import Link from "next/link";
import type { GlobalContext } from "@/lib/orchestrator/types";

export function ContextStrip({ context }: { context: GlobalContext }) {
  const items = [
    { label: "Você", value: context.answers.whoIsTheUser },
    { label: "Workspace", value: context.answers.whichWorkspace },
    { label: "Projeto", value: context.answers.whichActiveProject },
    { label: "Missão", value: context.answers.whichMission },
    { label: "Plano", value: context.answers.whichPlan },
  ];

  return (
    <div
      className="rounded-lg border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent p-3"
      data-testid="aura-context-strip"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Contexto global
        </p>
        <p className="text-[10px] text-zinc-600">
          completude {context.dataCompleteness.score}%
        </p>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[10px] text-zinc-600">{item.label}</dt>
            <dd className="truncate text-[12px] text-zinc-200">{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <Link href="/dashboard/projects" className="text-emerald-300/90 hover:underline">
          Projetos
        </Link>
        <Link href="/dashboard/plans" className="text-teal-300/90 hover:underline">
          Planos
        </Link>
        <Link href="/dashboard/agents" className="text-indigo-300/90 hover:underline">
          Agentes
        </Link>
        <Link href="/dashboard/automations" className="text-cyan-300/90 hover:underline">
          Automações
        </Link>
        <Link href="/dashboard/discovery" className="text-rose-300/90 hover:underline">
          Discovery
        </Link>
      </div>
    </div>
  );
}

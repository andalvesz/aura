"use client";

import Link from "next/link";
import { Loader2, Target } from "lucide-react";
import { useGoals } from "@/hooks";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  computeGoalMetrics,
  getActiveGoals,
  GOAL_TIPO_LABELS,
  isGoalBehind,
  sortGoalsByUrgency,
} from "@/utils/goals";

export function GoalsDashboardCard() {
  const { data: goals, loading } = useGoals();
  const active = sortGoalsByUrgency(getActiveGoals(goals)).slice(0, 3);

  return (
    <Panel className="border-amber-500/10 bg-amber-500/[0.03]">
      <PanelHeader className="flex flex-row items-center justify-between">
        <PanelTitle className="flex items-center gap-2">
          <Target className="size-3.5 text-amber-400" />
          Metas em andamento
        </PanelTitle>
        <Link
          href="/dashboard/metas"
          className="text-[11px] text-amber-300/80 hover:text-amber-200"
        >
          Ver todas →
        </Link>
      </PanelHeader>
      <PanelContent className="pt-0">
        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" />
            Carregando...
          </div>
        ) : active.length === 0 ? (
          <p className="text-[12px] text-zinc-500">
            Nenhuma meta ativa.{" "}
            <Link href="/dashboard/metas" className="text-amber-300/90 hover:text-amber-200">
              Criar meta
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((goal) => {
              const m = computeGoalMetrics(goal);
              const behind = isGoalBehind(goal);
              return (
                <li
                  key={goal.id}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] text-zinc-300">{goal.titulo}</p>
                    <span
                      className={`shrink-0 text-[11px] ${behind ? "text-rose-400" : "text-amber-300"}`}
                    >
                      {m.pct}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {GOAL_TIPO_LABELS[goal.tipo]}
                    {behind ? " · atrasada" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </PanelContent>
    </Panel>
  );
}

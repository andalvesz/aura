"use client";

import Link from "next/link";
import { Loader2, Target } from "lucide-react";
import type { Conteudo, Goal, InstagramMarca } from "@/types/database";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  computeGoalMetrics,
  formatGoalProgress,
  getActiveGoals,
} from "@/utils/goals";
import {
  countConteudosPlanejados,
  countConteudosPublicados,
} from "@/utils/social-filters";

type SocialContentGoalsPanelProps = {
  conteudos: Conteudo[];
  goals: Goal[];
  goalsLoading?: boolean;
  activeMarca?: InstagramMarca;
};

export function SocialContentGoalsPanel({
  conteudos,
  goals,
  goalsLoading = false,
  activeMarca,
}: SocialContentGoalsPanelProps) {
  const marcaFilter = activeMarca ?? "all";
  const planejadosSemana = countConteudosPlanejados(conteudos, "semana", marcaFilter);
  const publicadosSemana = countConteudosPublicados(conteudos, "semana", marcaFilter);
  const planejadosMes = countConteudosPlanejados(conteudos, "mes", marcaFilter);
  const publicadosMes = countConteudosPublicados(conteudos, "mes", marcaFilter);

  const contentGoals = getActiveGoals(goals).filter((g) => g.tipo === "conteudo");
  const primaryGoal = contentGoals[0] ?? null;
  const goalMetrics = primaryGoal ? computeGoalMetrics(primaryGoal) : null;

  const isWeeklyGoal =
    primaryGoal &&
    (() => {
      const start = new Date(`${primaryGoal.data_inicio}T12:00:00`);
      const end = new Date(`${primaryGoal.data_fim}T12:00:00`);
      const days =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return days <= 10;
    })();

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          label="Planejados (semana)"
          value={String(planejadosSemana)}
          hint="Com data nesta semana"
        />
        <MetricCard
          label="Publicados (semana)"
          value={String(publicadosSemana)}
          hint="Publicados nesta semana"
        />
        <MetricCard
          label="Planejados (mês)"
          value={String(planejadosMes)}
          hint="Com data neste mês"
        />
        <MetricCard
          label="Publicados (mês)"
          value={String(publicadosMes)}
          hint="Publicados neste mês"
        />
      </div>

      {(goalsLoading || primaryGoal) && (
        <Panel className="border-amber-500/10 bg-amber-500/[0.03]">
          <PanelHeader className="flex flex-row items-center justify-between gap-2">
            <PanelTitle className="flex items-center gap-2">
              <Target className="size-3.5 text-amber-400" />
              Meta de conteúdo
            </PanelTitle>
            <Link
              href="/dashboard/metas"
              className="text-[11px] text-amber-300/80 hover:text-amber-200"
            >
              Ver metas →
            </Link>
          </PanelHeader>
          <PanelContent className="pt-0">
            {goalsLoading ? (
              <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                <Loader2 className="size-3.5 animate-spin" />
                Carregando meta...
              </div>
            ) : primaryGoal && goalMetrics ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-zinc-200">
                    {primaryGoal.titulo}
                  </p>
                  <span className="text-[12px] text-amber-300">
                    {formatGoalProgress(primaryGoal)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-amber-500/70 transition-all"
                    style={{ width: `${goalMetrics.pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  {isWeeklyGoal ? "Meta semanal" : "Meta mensal ou personalizada"} ·{" "}
                  faltam {goalMetrics.remaining} para a meta
                </p>
              </div>
            ) : null}
          </PanelContent>
        </Panel>
      )}
    </div>
  );
}

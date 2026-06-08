"use client";

import Link from "next/link";
import { Flame, Loader2, Target } from "lucide-react";
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
import type { PostingStreakInfo } from "@/utils/social-intelligence";

type SocialContentGoalsPanelProps = {
  conteudos: Conteudo[];
  goals: Goal[];
  goalsLoading?: boolean;
  activeMarca?: InstagramMarca;
  streak?: PostingStreakInfo;
};

function isWeeklyGoal(goal: Goal): boolean {
  const start = new Date(`${goal.data_inicio}T12:00:00`);
  const end = new Date(`${goal.data_fim}T12:00:00`);
  const days =
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return days <= 10;
}

function formatDiasSemPostar(streak: PostingStreakInfo): string {
  if (streak.publicouHoje) return "0";
  if (streak.diasSemPostar < 0) return "—";
  return String(streak.diasSemPostar);
}

export function SocialContentGoalsPanel({
  conteudos,
  goals,
  goalsLoading = false,
  activeMarca,
  streak,
}: SocialContentGoalsPanelProps) {
  const marcaFilter = activeMarca ?? "all";
  const planejadosSemana = countConteudosPlanejados(conteudos, "semana", marcaFilter);
  const publicadosSemana = countConteudosPublicados(conteudos, "semana", marcaFilter);
  const planejadosMes = countConteudosPlanejados(conteudos, "mes", marcaFilter);
  const publicadosMes = countConteudosPublicados(conteudos, "mes", marcaFilter);

  const contentGoals = getActiveGoals(goals).filter((g) => g.tipo === "conteudo");
  const weeklyGoal = contentGoals.find(isWeeklyGoal) ?? null;
  const monthlyGoal = contentGoals.find((g) => !isWeeklyGoal(g)) ?? null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          label="Meta semanal"
          value={weeklyGoal ? formatGoalProgress(weeklyGoal) : `${publicadosSemana} pub.`}
          hint={
            weeklyGoal
              ? "Meta de conteúdo ativa"
              : "Publicados esta semana (sem meta)"
          }
        />
        <MetricCard
          label="Meta mensal"
          value={monthlyGoal ? formatGoalProgress(monthlyGoal) : `${publicadosMes} pub.`}
          hint={
            monthlyGoal
              ? "Meta de conteúdo ativa"
              : "Publicados este mês (sem meta)"
          }
        />
        <MetricCard
          label="Dias sem postar"
          value={streak ? formatDiasSemPostar(streak) : "—"}
          hint={
            streak?.publicouHoje
              ? "Publicou hoje"
              : streak?.ultimaPublicacao
                ? `Última: ${streak.ultimaPublicacao}`
                : "Sem publicações"
          }
        />
        <MetricCard
          label="Sequência"
          value={streak ? `${streak.sequenciaAtual} dia(s)` : "—"}
          hint="Dias consecutivos publicando"
        />
      </div>

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

      {(goalsLoading || weeklyGoal || monthlyGoal) && (
        <Panel className="border-amber-500/10 bg-amber-500/[0.03]">
          <PanelHeader className="flex flex-row items-center justify-between gap-2">
            <PanelTitle className="flex items-center gap-2">
              <Target className="size-3.5 text-amber-400" />
              Metas de conteúdo
            </PanelTitle>
            <Link
              href="/dashboard/metas"
              className="text-[11px] text-amber-300/80 hover:text-amber-200"
            >
              Ver metas →
            </Link>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            {goalsLoading ? (
              <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                <Loader2 className="size-3.5 animate-spin" />
                Carregando meta...
              </div>
            ) : (
              <>
                {weeklyGoal && (
                  <GoalProgressBar goal={weeklyGoal} label="Meta semanal" />
                )}
                {monthlyGoal && (
                  <GoalProgressBar goal={monthlyGoal} label="Meta mensal" />
                )}
              </>
            )}
          </PanelContent>
        </Panel>
      )}

      {streak && streak.sequenciaAtual >= 3 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-500/15 bg-orange-500/[0.04] px-3 py-2 text-[11px] text-orange-200/90">
          <Flame className="size-3.5 shrink-0 text-orange-400" />
          Sequência de {streak.sequenciaAtual} dias publicando — continue!
        </div>
      )}
    </div>
  );
}

function GoalProgressBar({ goal, label }: { goal: Goal; label: string }) {
  const metrics = computeGoalMetrics(goal);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-zinc-200">
          {label}: {goal.titulo}
        </p>
        <span className="text-[11px] text-amber-300">
          {formatGoalProgress(goal)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-amber-500/70 transition-all"
          style={{ width: `${metrics.pct}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-500">
        Faltam {metrics.remaining} para a meta
      </p>
    </div>
  );
}

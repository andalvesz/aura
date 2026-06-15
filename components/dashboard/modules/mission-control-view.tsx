"use client";

import {
  CheckCircle2,
  Circle,
  Crown,
  Loader2,
  Radar,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useMissionControl } from "@/hooks/use-mission-control";
import type { ExecutionTask } from "@/types/database";
import { cn } from "@/utils/cn";
import { getDailyTasks } from "@/utils/execution";
import {
  getMissionStepStatusColor,
  getMissionStepStatusLabel,
  MISSION_ACTIONS,
  type MissionActionId,
  type MissionStepStatus,
} from "@/utils/mission-control";

function ProgressBadge({ status }: { status: MissionStepStatus }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        getMissionStepStatusColor(status)
      )}
    >
      {getMissionStepStatusLabel(status)}
    </span>
  );
}

function TaskRow({ task }: { task: ExecutionTask }) {
  const done = task.status === "completed";
  return (
    <div className="flex items-start gap-2 rounded-md border border-white/[0.06] px-3 py-2">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="mt-0.5 size-3.5 shrink-0 text-amber-400/70" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[11px] font-medium", done ? "text-zinc-500 line-through" : "text-zinc-200")}>
          {task.titulo}
        </p>
        {task.descricao && (
          <p className="mt-0.5 text-[10px] text-zinc-500">{task.descricao}</p>
        )}
        {task.href && !done && (
          <Link href={task.href} className="mt-1 inline-block text-[10px] text-cyan-400 hover:underline">
            Abrir →
          </Link>
        )}
      </div>
    </div>
  );
}

export function MissionControlView() {
  const { dashboard, tasks, briefing, loading, error, busy, runAction } = useMissionControl();

  async function handleAction(action: MissionActionId) {
    const { message, error: actionError } = await runAction(action);
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
    if (actionError) toast.warning(actionError);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Erro ao carregar" description={error} />;
  }

  const mission = dashboard?.activeMission;
  const dailyTasks = getDailyTasks(tasks);
  const actionButtons = MISSION_ACTIONS.filter((a) => a.id !== "generate_daily_advice");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
        <Shield className="size-4 shrink-0 text-emerald-400" />
        <p className="text-[11px] text-emerald-200/90">
          {dashboard?.safeMode.message ??
            "Modo seguro — anúncios não publicados e orçamento não aumentado automaticamente."}
        </p>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-4 text-cyan-400" />
            Missão ativa
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          {mission ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-[10px] text-zinc-500">Nome da missão</p>
                <p className="text-[13px] font-medium text-zinc-100">{mission.nome}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">País · Idioma · Moeda</p>
                <p className="text-[12px] text-zinc-300">
                  {mission.pais} · {mission.idioma} · {mission.moeda}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Meta financeira</p>
                <p className="text-[12px] font-medium text-emerald-300">{mission.metaFinanceiraFormatted}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Orçamento</p>
                <p className="text-[12px] font-medium text-violet-300">{mission.orcamentoFormatted}</p>
              </div>
              <div className="sm:col-span-2">
                <Link
                  href="/dashboard/smart-launch"
                  className="text-[10px] text-orange-400 hover:underline"
                >
                  Abrir Smart Launch →
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-zinc-400">Nenhuma missão ativa.</p>
              <Link
                href="/dashboard/smart-launch"
                className="inline-flex text-[11px] text-orange-400 hover:underline"
              >
                Preparar lançamento no Smart Launch →
              </Link>
            </div>
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Radar className="size-4 text-violet-400" />
            Progresso
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {dashboard?.progress.map((step) => (
            <div
              key={step.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2"
            >
              <span className="text-[12px] font-medium text-zinc-200">{step.label}</span>
              <ProgressBadge status={step.status} />
            </div>
          ))}
        </PanelContent>
      </Panel>

      {dashboard?.revenue && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Receita atual"
            value={dashboard.revenue.receitaFormatted}
            hint="Mês corrente"
          />
          <MetricCard
            label="Investimento"
            value={dashboard.revenue.investimentoFormatted}
            hint="Orçamento da missão"
          />
          <MetricCard
            label="Lucro"
            value={dashboard.revenue.lucroFormatted}
            hint="Líquido no mês"
          />
          <MetricCard
            label="ROI"
            value={dashboard.revenue.roiFormatted}
            hint="Retorno estimado"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader className="flex items-center justify-between gap-2">
            <PanelTitle className="flex items-center gap-2">
              <Crown className="size-4 text-amber-400" />
              Aura CEO — Conselho diário
            </PanelTitle>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAction("generate_daily_advice")}
              className="text-[10px] text-amber-400 hover:underline disabled:opacity-50"
            >
              Gerar →
            </button>
          </PanelHeader>
          <PanelContent className="space-y-2 text-[11px]">
            {dashboard?.dailyAdvice ? (
              <>
                <p className="leading-relaxed text-zinc-300">{dashboard.dailyAdvice.conselhoCeo}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                    <p className="text-[10px] text-zinc-500">Projeto prioritário</p>
                    <p className="text-zinc-300">{dashboard.dailyAdvice.projetoPrioritario}</p>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                    <p className="text-[10px] text-zinc-500">Meta financeira</p>
                    <p className="text-zinc-300">{dashboard.dailyAdvice.metaFinanceira}</p>
                  </div>
                </div>
                {briefing?.greeting && (
                  <p className="text-[10px] text-zinc-500">{briefing.greeting}</p>
                )}
              </>
            ) : (
              <p className="text-zinc-500">Gere o conselho diário para receber orientação do CEO.</p>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-cyan-400" />
              Performance AI
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2 text-[11px]">
            {dashboard?.performance ? (
              <>
                <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-2">
                  <p className="text-[10px] text-emerald-400/80">Maior oportunidade</p>
                  <p className="text-zinc-300">{dashboard.performance.maiorOportunidade}</p>
                </div>
                <div className="rounded-md border border-rose-500/15 bg-rose-500/[0.04] p-2">
                  <p className="text-[10px] text-rose-400/80">Maior risco</p>
                  <p className="text-zinc-300">{dashboard.performance.maiorRisco}</p>
                </div>
                <div className="rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-2">
                  <p className="text-[10px] text-violet-400/80">Recomendação</p>
                  <p className="text-zinc-300">{dashboard.performance.recomendacao}</p>
                </div>
              </>
            ) : (
              <p className="text-zinc-500">
                Atualize a Performance AI para ver oportunidades e riscos.
              </p>
            )}
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-sky-400" />
            Execution — Tarefas do dia
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {dailyTasks.length > 0 ? (
            dailyTasks.slice(0, 8).map((task) => <TaskRow key={task.id} task={task} />)
          ) : (
            <p className="text-[11px] text-zinc-500">
              Nenhuma tarefa do dia.{" "}
              <Link href="/dashboard/execution" className="text-cyan-400 hover:underline">
                Abrir Execution →
              </Link>
            </p>
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Ações operacionais</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-2">
            {actionButtons.map((action) => (
              <ActionButton
                key={action.id}
                disabled={busy}
                onClick={() => void handleAction(action.id)}
                className="text-[11px]"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {action.label}
              </ActionButton>
            ))}
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}

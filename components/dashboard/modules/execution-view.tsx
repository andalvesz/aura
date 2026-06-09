"use client";

import {
  Battery,
  CheckCircle2,
  Circle,
  Crown,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAuraXp } from "@/hooks/use-aura-xp";
import { useExecution } from "@/hooks/use-execution";
import type { ExecutionTask } from "@/types/database";
import { cn } from "@/utils/cn";
import {
  EXECUTION_AREAS,
  EXECUTION_IA_ACTIONS,
  getAreaLabel,
  getDailyTasks,
  getModuloLabel,
  getWeeklyTasksByArea,
} from "@/utils/execution";
import { parseJsonResponse } from "@/utils/safe-json";

function TaskItem({
  task,
  busy,
  onComplete,
}: {
  task: ExecutionTask;
  busy: boolean;
  onComplete: (id: string) => void;
}) {
  const done = task.status === "completed";

  return (
    <li>
      <div className="flex items-start gap-2">
        <button
          type="button"
          disabled={busy || done}
          onClick={() => onComplete(task.id)}
          className="mt-0.5 shrink-0 disabled:opacity-50"
        >
          {done ? (
            <CheckCircle2 className="size-3.5 text-emerald-400" />
          ) : (
            <Circle className="size-3.5 text-zinc-600" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "text-[11px] font-medium",
                done ? "text-zinc-500 line-through" : "text-zinc-200"
              )}
            >
              {task.titulo}
            </span>
            {task.href && !done && (
              <Link href={task.href} className="text-[10px] text-cyan-400 hover:underline">
                Abrir →
              </Link>
            )}
          </div>
          {task.descricao && (
            <p className="text-[10px] text-zinc-500">{task.descricao}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-white/[0.04] px-1 py-0.5 text-[9px] text-zinc-500">
              P {task.prioridade}
            </span>
            <span className="rounded bg-white/[0.04] px-1 py-0.5 text-[9px] text-zinc-500">
              I {task.impacto}
            </span>
            <span className="rounded bg-white/[0.04] px-1 py-0.5 text-[9px] text-zinc-500">
              U {task.urgencia}
            </span>
            <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-400/80">
              ROI {task.roi}%
            </span>
            <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-400/80">
              ⚡ {task.energia}/5
            </span>
            <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] text-violet-400/80">
              {getModuloLabel(task.modulo_origem)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function DailyBriefingPanel({
  briefing,
}: {
  briefing: {
    greeting: string;
    projeto_prioritario: string;
    meta_financeira: string;
    probabilidade_atual: number;
    conselho_ceo: string;
  };
}) {
  return (
    <div className="space-y-3 rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
      <p className="text-[14px] font-semibold text-cyan-100">{briefing.greeting}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Projeto prioritário</p>
          <p className="text-[12px] font-medium text-zinc-200">{briefing.projeto_prioritario}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Meta financeira</p>
          <p className="text-[12px] font-medium text-emerald-300">{briefing.meta_financeira}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Probabilidade atual</p>
          <p className="text-[12px] font-medium text-violet-300">{briefing.probabilidade_atual}%</p>
        </div>
      </div>

      <div className="rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-violet-300">
          <Crown className="size-3" />
          Conselho do Aura CEO
        </p>
        <p className="text-[11px] italic leading-relaxed text-zinc-300">
          &ldquo;{briefing.conselho_ceo}&rdquo;
        </p>
      </div>
    </div>
  );
}

export function ExecutionView() {
  const { refresh: refreshXp } = useAuraXp();
  const {
    dashboard,
    plan,
    tasks,
    briefing,
    history,
    loading,
    error,
    busy,
    refresh,
    generateDaily,
    completeTask,
    removePlan,
  } = useExecution();

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Execution Engine — transformo planos em tarefas executáveis. Gere seu plano diário para começar.",
    },
  ]);

  async function handleGenerateDaily() {
    const { error: genError } = await generateDaily();
    if (genError) {
      toast.error(genError);
      return;
    }
    toast.success("Plano diário gerado!");
  }

  async function handleComplete(taskId: string) {
    const { xpAwarded, planComplete, error: completeError } = await completeTask(taskId);
    if (completeError) {
      toast.error(completeError);
      return;
    }
    if (xpAwarded > 0) {
      toast.success(`+${xpAwarded} XP`);
      void refreshXp();
    } else {
      toast.success("Tarefa concluída!");
    }
    if (planComplete) {
      toast.success("Plano do dia completo! 🎉");
    }
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    const historyMsgs = iaMessages.map((m) => ({ role: m.role, content: m.text }));
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/execution/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historyMsgs,
          ...(actionId ? { actionId } : {}),
        }),
      });
      const { data: body, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || body?.error) {
        setIaMessages((c) => [
          ...c,
          { role: "assistant", text: body?.error ?? parseError ?? "Erro na IA." },
        ]);
        return;
      }

      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: body?.text ?? "Sem resposta." },
      ]);
    } catch {
      setIaMessages((c) => [...c, { role: "assistant", text: "Erro de conexão." }]);
    } finally {
      setIaLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <Panel className="border-rose-500/15 bg-rose-500/[0.03]">
        <PanelContent className="py-4 text-center text-[12px] text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 block w-full text-[11px] text-rose-200 underline"
          >
            Tentar novamente
          </button>
        </PanelContent>
      </Panel>
    );
  }

  const dailyTasks = getDailyTasks(tasks);
  const weeklyByArea = getWeeklyTasksByArea(tasks);

  return (
    <div className="space-y-3">
      <Panel className="border-cyan-500/15 bg-cyan-500/[0.03]">
        <PanelContent className="py-2.5 text-[11px] text-cyan-200/90">
          Integra <strong>Aura CEO</strong>, Money Missions, Orchestrator, Launch, Creator, Social,
          Alvesz, Financeiro, Calendário, Saúde e Idiomas em tarefas executáveis.
        </PanelContent>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Score de execução"
          value={`${dashboard?.scoreExecucao ?? 0}/100`}
          hint="Prontidão do dia"
        />
        <MetricCard
          label="Missões concluídas"
          value={`${dashboard?.missoesConcluidas ?? 0}/${dashboard?.missoesTotal ?? 0}`}
          hint="Progresso diário"
        />
        <MetricCard
          label="Diárias pendentes"
          value={String(dashboard?.missoesDiariasPendentes ?? 0)}
          hint="Para hoje"
        />
        <MetricCard
          label="XP ganho hoje"
          value={`+${dashboard?.xpGanhoHoje ?? 0}`}
          hint="Execution Engine"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          disabled={busy}
          icon={
            busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Rocket className="size-3.5" />
            )
          }
          onClick={() => void handleGenerateDaily()}
        >
          Gerar plano diário
        </ActionButton>
        {plan && (
          <ActionButton
            variant="ghost"
            disabled={busy}
            icon={<Trash2 className="size-3.5" />}
            onClick={() =>
              void removePlan(plan.id).then((r) => {
                if (r.error) toast.error(r.error);
                else toast.success("Plano removido.");
              })
            }
          >
            Excluir plano
          </ActionButton>
        )}
      </div>

      {briefing && (
        <Panel className="border-cyan-500/20">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-cyan-400" />
              Daily Briefing
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <DailyBriefingPanel briefing={briefing} />
          </PanelContent>
        </Panel>
      )}

      {!plan ? (
        <EmptyState
          title="Nenhum plano para hoje"
          description="Clique em Gerar plano diário — a IA calcula prioridade, impacto, urgência, ROI e energia."
        />
      ) : (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle className="flex items-center gap-2">
                <Target className="size-3.5 text-cyan-400" />
                Missões do dia
                <span className="text-[10px] font-normal text-zinc-500">
                  {dailyTasks.filter((t) => t.status === "completed").length}/{dailyTasks.length}
                </span>
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {dailyTasks.length === 0 ? (
                <p className="text-[11px] text-zinc-500">Nenhuma missão diária.</p>
              ) : (
                <ul className="space-y-2.5">
                  {dailyTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      busy={busy}
                      onComplete={(id) => void handleComplete(id)}
                    />
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle className="flex items-center gap-2">
                <TrendingUp className="size-3.5" />
                Missões da semana
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3 pt-0">
              {EXECUTION_AREAS.map((area) => {
                const areaTasks = weeklyByArea[area.id];
                if (areaTasks.length === 0) return null;
                return (
                  <div key={area.id}>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      {area.label}
                    </p>
                    <ul className="space-y-2">
                      {areaTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          busy={busy}
                          onComplete={(id) => void handleComplete(id)}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
              {Object.values(weeklyByArea).every((a) => a.length === 0) && (
                <p className="text-[11px] text-zinc-500">Nenhuma missão semanal.</p>
              )}
            </PanelContent>
          </Panel>

          {plan.resumo && (
            <Panel className="border-white/[0.04]">
              <PanelHeader>
                <PanelTitle className="flex items-center gap-2 text-[12px]">
                  <Zap className="size-3.5 text-amber-400" />
                  Resumo do plano
                </PanelTitle>
              </PanelHeader>
              <PanelContent className="pt-0">
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">
                  {plan.resumo}
                </p>
              </PanelContent>
            </Panel>
          )}
        </>
      )}

      {history.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2 text-[12px]">
              <Battery className="size-3.5" />
              Executive Memory · hoje
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-1.5 pt-0">
            {history.slice(0, 8).map((h) => (
              <p key={h.id} className="text-[10px] text-zinc-500">
                <span className="text-zinc-400">{h.evento}</span>
                {h.modulo ? ` · ${h.modulo}` : ""}
                {h.xp_ganho > 0 ? ` · +${h.xp_ganho} XP` : ""}
              </p>
            ))}
          </PanelContent>
        </Panel>
      )}

      <Panel className="border-cyan-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-cyan-400" />
            Aura Coach
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {EXECUTION_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-cyan-500/30 hover:text-cyan-300 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.04] bg-black/20 p-2">
            {iaMessages.map((m, i) => (
              <p
                key={i}
                className={cn(
                  "whitespace-pre-wrap text-[11px]",
                  m.role === "user" ? "text-cyan-200" : "text-zinc-400"
                )}
              >
                {m.text}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendIaMessage(iaInput);
            }}
          >
            <input
              value={iaInput}
              onChange={(e) => setIaInput(e.target.value)}
              placeholder="O que devo fazer hoje? Estou atrasado?"
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-cyan-500/40"
            />
            <ActionButton
              type="submit"
              disabled={iaLoading || !iaInput.trim()}
              icon={
                iaLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )
              }
            >
              Enviar
            </ActionButton>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}

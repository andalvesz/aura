"use client";

import { Check, Loader2, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { AddGoalModal } from "@/components/dashboard/modules/add-goal-modal";
import { useGoals } from "@/hooks";
import type { Goal } from "@/types/database";
import { formatBRL } from "@/utils/format";
import {
  computeGoalMetrics,
  formatGoalForecast,
  getActiveGoals,
  GOAL_TIPO_LABELS,
  isGoalBehind,
  sortGoalsByUrgency,
} from "@/utils/goals";

export function MetasView() {
  const { data: goals, loading, error, create, update, remove, refresh } = useGoals();
  const [modalOpen, setModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const active = getActiveGoals(goals);
  const sorted = sortGoalsByUrgency(active);

  async function handleSync() {
    setSyncing(true);
    await refresh(true);
    setSyncing(false);
  }

  return (
    <div className="space-y-3">
      <Panel className="border-amber-500/10 bg-amber-500/[0.02]">
        <PanelHeader className="flex flex-row items-center justify-between gap-2">
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-4 text-amber-400" />
            Metas em andamento
          </PanelTitle>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={syncing}
              onClick={handleSync}
              className="inline-flex min-h-8 items-center gap-1 rounded-md border border-white/[0.08] px-2.5 text-[11px] text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
            >
              {syncing ? <Loader2 className="size-3 animate-spin" /> : null}
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex min-h-8 items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 text-[11px] text-amber-200 hover:bg-amber-500/15"
            >
              <Plus className="size-3.5" />
              Nova meta
            </button>
          </div>
        </PanelHeader>
        <PanelContent className="space-y-3 pt-0">
          <p className="text-[12px] text-zinc-500">
            Metas pessoais, financeiras e profissionais com progresso automático a partir dos
            módulos da Aura.
          </p>

          {loading ? (
            <ListSkeleton rows={3} />
          ) : error ? (
            <p className="py-4 text-center text-[12px] text-rose-400">{error}</p>
          ) : sorted.length === 0 ? (
            <EmptyState
              title="Nenhuma meta ativa"
              description="Crie metas financeiras, de saúde, conteúdo, vendas ou eventos. O progresso é calculado com dados reais."
              action={
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 text-[11px] text-amber-200"
                >
                  <Plus className="size-3.5" />
                  Criar primeira meta
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {sorted.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onComplete={async (id) => {
                    const { error: err } = await update(id, { status: "concluida" });
                    if (err) toast.error(err);
                    else toast.success("Meta concluída.");
                  }}
                  onDelete={async (id) => {
                    if (!confirm("Excluir esta meta?")) return;
                    const { error: err } = await remove(id);
                    if (err) toast.error(err);
                    else toast.success("Meta excluída.");
                  }}
                />
              ))}
            </div>
          )}

          {goals.filter((g) => g.status === "concluida").length > 0 && (
            <div className="border-t border-white/[0.06] pt-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Concluídas
              </p>
              <div className="space-y-2">
                {goals
                  .filter((g) => g.status === "concluida")
                  .slice(0, 5)
                  .map((goal) => (
                    <p key={goal.id} className="text-[12px] text-zinc-500">
                      ✓ {goal.titulo}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </PanelContent>
      </Panel>

      <AddGoalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={create}
      />
    </div>
  );
}

function GoalCard({
  goal,
  onComplete,
  onDelete,
}: {
  goal: Goal;
  onComplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const m = computeGoalMetrics(goal);
  const behind = isGoalBehind(goal);
  const isMoney = goal.tipo === "financeira";

  return (
    <div className="rounded-md border border-white/[0.06] bg-zinc-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
            {GOAL_TIPO_LABELS[goal.tipo]}
          </p>
          <p className="text-[13px] font-medium text-zinc-200">{goal.titulo}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {behind && (
            <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400">
              Atrasada
            </span>
          )}
          <button
            type="button"
            title="Marcar como concluída"
            onClick={() => void onComplete(goal.id)}
            className="rounded p-1 text-zinc-600 hover:text-emerald-400"
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            title="Excluir meta"
            onClick={() => void onDelete(goal.id)}
            className="rounded p-1 text-zinc-600 hover:text-rose-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all ${behind ? "bg-rose-500/70" : "bg-amber-500/70"}`}
          style={{ width: `${m.pct}%` }}
        />
      </div>

      <div className="mt-2 grid gap-1 sm:grid-cols-3">
        <Metric label="Progresso" value={`${m.pct}%`} />
        <Metric
          label="Atual / Meta"
          value={
            isMoney
              ? `${formatBRL(m.atual)} / ${formatBRL(m.meta)}`
              : `${m.atual} / ${m.meta}`
          }
        />
        <Metric
          label="Restante"
          value={isMoney ? formatBRL(m.remaining) : String(m.remaining)}
        />
      </div>

      <p className="mt-2 text-[11px] text-zinc-500">{formatGoalForecast(goal)}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="text-[12px] text-zinc-300">{value}</p>
    </div>
  );
}

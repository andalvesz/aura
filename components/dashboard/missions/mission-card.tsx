"use client";

import { useTransition } from "react";
import {
  completeMissionTask,
  updateMissionStatus,
} from "@/app/actions/missions";
import type { Mission, MissionStatus } from "@/lib/missions/mission-types";

const STATUS_LABEL: Record<MissionStatus, string> = {
  PLANNING: "Planejando",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  BLOCKED: "Bloqueada",
  COMPLETED: "Concluída",
  ARCHIVED: "Arquivada",
};

export function MissionCard({ mission }: { mission: Mission }) {
  const [pending, startTransition] = useTransition();
  const nextTask = mission.tasks.find(
    (t) => t.status === "pending" || t.status === "in_progress"
  );
  const nextMilestone = mission.milestones.find((m) => !m.completed);
  const openRisks = mission.risks.filter((r) => r.status === "open").slice(0, 3);
  const phaseBreakdown = mission.progress.breakdown.filter((b) =>
    b.key.startsWith("phase:")
  );

  return (
    <article
      className="space-y-3 rounded-lg border border-white/[0.08] bg-zinc-950/40 p-4"
      data-testid="mission-card"
      data-mission-id={mission.id}
      data-mission-status={mission.status}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            {mission.type} · {STATUS_LABEL[mission.status]}
          </p>
          <h3 className="truncate text-[15px] font-medium text-zinc-100">
            {mission.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-zinc-500">
            {mission.description}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-zinc-100">
            {mission.progress.totalPct}%
          </p>
          <p className="text-[10px] text-zinc-600">
            saúde {mission.score.health} · risco {100 - mission.score.risk}
          </p>
        </div>
      </header>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuenow={mission.progress.totalPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-emerald-500/80"
          style={{ width: `${mission.progress.totalPct}%` }}
        />
      </div>

      {phaseBreakdown.length > 0 ? (
        <ul className="grid gap-1 sm:grid-cols-2" data-testid="mission-phases">
          {phaseBreakdown.map((b) => (
            <li
              key={b.key}
              className="flex items-center justify-between gap-2 text-[11px] text-zinc-400"
            >
              <span className="truncate">{b.label}</span>
              <span className="tabular-nums text-zinc-300">{b.pct}%</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 text-[12px] sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase text-zinc-600">Próximo marco</p>
          <p className="text-zinc-300">
            {nextMilestone?.title ?? "Nenhum marco pendente"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-600">Tempo restante</p>
          <p className="text-zinc-300">
            {mission.progress.remainingDays == null
              ? "Sem prazo"
              : `${mission.progress.remainingDays} dias`}
          </p>
        </div>
      </div>

      {openRisks.length > 0 ? (
        <div data-testid="mission-risks">
          <p className="text-[10px] uppercase text-zinc-600">Riscos</p>
          <ul className="mt-1 space-y-1">
            {openRisks.map((r) => (
              <li key={r.id} className="text-[12px] text-amber-300/90">
                [{r.level}] {r.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mission.recommendations[0] ? (
        <div data-testid="mission-suggested-action">
          <p className="text-[10px] uppercase text-zinc-600">Ação sugerida</p>
          <p className="text-[12px] text-zinc-300">
            {mission.recommendations[0].title}
          </p>
          <p className="text-[11px] text-zinc-600">
            {mission.recommendations[0].reason}
            {mission.recommendations[0].autoExecutable
              ? ""
              : " · requer confirmação"}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {nextTask ? (
          <button
            type="button"
            disabled={pending || nextTask.status === "blocked"}
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-white/5 disabled:opacity-40"
            data-testid="mission-complete-task"
            onClick={() =>
              startTransition(async () => {
                await completeMissionTask(mission.id, nextTask.id);
              })
            }
          >
            Concluir: {nextTask.title}
          </button>
        ) : null}
        {mission.status === "ACTIVE" || mission.status === "PLANNING" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-white/5"
            onClick={() =>
              startTransition(async () => {
                await updateMissionStatus(mission.id, "PAUSED");
              })
            }
          >
            Pausar
          </button>
        ) : null}
        {mission.status === "PAUSED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-white/5"
            onClick={() =>
              startTransition(async () => {
                await updateMissionStatus(mission.id, "ACTIVE");
              })
            }
          >
            Retomar
          </button>
        ) : null}
      </div>

      <p className="text-[10px] text-zinc-700">
        Módulos: {mission.modules.join(", ")}
      </p>
    </article>
  );
}

"use client";

import { Check, Loader2, Sparkles, Trophy } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAuraXp } from "@/hooks/use-aura-xp";
import { formatAchievementLabel, formatXpRemaining } from "@/utils/xp";
import { formatDate } from "@/utils/format";

export function AuraXpPanel() {
  const { state, loading, error, refresh } = useAuraXp();

  if (loading) {
    return (
      <Panel className="border-violet-500/10 bg-violet-500/[0.03]">
        <PanelContent className="flex items-center gap-2 py-6 text-[12px] text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" />
          Carregando progresso...
        </PanelContent>
      </Panel>
    );
  }

  if (error || !state) {
    return (
      <Panel className="border-violet-500/10 bg-violet-500/[0.03]">
        <PanelContent className="py-4">
          <p className="text-[12px] text-zinc-500">
            {error ?? "Progresso indisponível."}{" "}
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-violet-300/90 hover:text-violet-200"
            >
              Tentar novamente
            </button>
          </p>
        </PanelContent>
      </Panel>
    );
  }

  const { userXp, progress, streakDisplay, recentAchievements, dailyMissions } = state;
  const remaining = formatXpRemaining(userXp.xp_total);

  return (
    <Panel className="border-violet-500/10 bg-violet-500/[0.03]">
      <PanelHeader className="flex flex-row items-center justify-between gap-2">
        <PanelTitle className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-violet-400" />
          Aura XP
        </PanelTitle>
        {userXp.streak_dias > 0 && (
          <span className="text-[11px] text-amber-300/90" title={`${userXp.streak_dias} dias consecutivos`}>
            {streakDisplay} {userXp.streak_dias}d
          </span>
        )}
      </PanelHeader>
      <PanelContent className="space-y-4 pt-0">
        <div>
          <div className="mb-1.5 flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Nível atual</p>
              <p className="text-2xl font-semibold text-violet-200">{progress.level}</p>
            </div>
            <p className="text-right text-[11px] text-zinc-500">
              {userXp.xp_total} XP
              <span className="block text-zinc-600">
                {remaining > 0 ? `${remaining} XP para nível ${progress.level + 1}` : "Nível máximo alcançado"}
              </span>
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500/80 to-fuchsia-500/70 transition-all duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">
            {progress.xpInLevel}/{progress.xpNeeded} XP neste nível
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Missões diárias
          </p>
          <ul className="space-y-1.5">
            {dailyMissions.map((mission) => (
              <li
                key={mission.id}
                className="flex items-center gap-2 rounded-md border border-white/[0.04] px-2 py-1.5 text-[12px]"
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    mission.done
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : "border-white/10 text-zinc-600"
                  }`}
                >
                  {mission.done ? <Check className="size-2.5" /> : null}
                </span>
                <span className={mission.done ? "text-zinc-400 line-through" : "text-zinc-300"}>
                  {mission.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <Trophy className="size-3 text-amber-400/80" />
            Últimas conquistas
          </p>
          {recentAchievements.length === 0 ? (
            <EmptyState
              title="Nenhuma conquista ainda"
              description="Registre finanças, complete hábitos ou avance no CRM para ganhar XP."
            />
          ) : (
            <ul className="space-y-1.5">
              {recentAchievements.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] px-2 py-1.5 text-[11px]"
                >
                  <span className="truncate text-zinc-300">{formatAchievementLabel(entry)}</span>
                  <span className="shrink-0 text-violet-300/90">+{entry.xp}</span>
                </li>
              ))}
            </ul>
          )}
          {recentAchievements[0] && (
            <p className="mt-1.5 text-[10px] text-zinc-600">
              Última: {formatDate(recentAchievements[0].created_at, "—")}
            </p>
          )}
        </div>
      </PanelContent>
    </Panel>
  );
}

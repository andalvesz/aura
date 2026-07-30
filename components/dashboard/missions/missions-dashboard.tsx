import Link from "next/link";
import { Crosshair } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CreateMissionForm } from "@/components/dashboard/missions/create-mission-form";
import { MissionCard } from "@/components/dashboard/missions/mission-card";
import { getMissionEngine } from "@/lib/supabase/services/mission.service";
import type { AuraIntelligenceResult } from "@/lib/intelligence/types";

export async function MissionsDashboard({
  intelligence,
}: {
  intelligence?: AuraIntelligenceResult;
} = {}) {
  const engine = await getMissionEngine({ intelligence });
  const active = engine.active.filter((m) => m.status !== "ARCHIVED");
  const insights = engine.insights.slice(0, 8);

  return (
    <section className="space-y-4" data-testid="missions-dashboard">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Crosshair className="size-5 text-amber-400" />
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
            Missões
          </h1>
        </div>
        <p className="text-sm text-zinc-500">
          Organize a vida por missões — módulos servem o objetivo.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Voltar ao Meu Dia
        </Link>
        {process.env.NODE_ENV === "development" ? (
          <p className="text-[10px] text-zinc-700">
            engine {engine.meta.totalMs}ms · planner {engine.meta.plannerMs}ms ·
            progress {engine.meta.progressMs}ms
          </p>
        ) : null}
      </header>

      {engine.missionOfTheDay ? (
        <DashboardCard
          title="Missão do dia"
          status="ok"
          className="border-amber-500/20"
          testId="mission-of-the-day"
        >
          <p className="text-[13px] text-zinc-200">
            {engine.missionOfTheDay.message}
          </p>
          {engine.missionOfTheDay.nextTask ? (
            <p className="mt-1 text-[12px] text-zinc-500">
              Próxima tarefa: {engine.missionOfTheDay.nextTask.title}
            </p>
          ) : null}
        </DashboardCard>
      ) : null}

      <DashboardCard
        title="Nova missão"
        status="ok"
        testId="missions-create"
      >
        <CreateMissionForm />
      </DashboardCard>

      <DashboardCard
        title="Missões ativas"
        status={active.length ? "ok" : "empty"}
        emptyTitle="Nenhuma missão ainda"
        emptyDescription="Crie uma missão — o Aura Brain gera fases, marcos, tarefas e riscos."
        testId="missions-active"
      >
        <div className="space-y-3">
          {active.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      </DashboardCard>

      <DashboardCard
        title="Mission Insights"
        status={insights.length ? "ok" : "empty"}
        emptyTitle="Sem insights"
        emptyDescription="Insights aparecem conforme o progresso das missões."
        testId="mission-insights"
      >
        <ul className="space-y-2">
          {insights.map((ins) => (
            <li key={ins.id} className="text-[12px]" data-insight-kind={ins.kind}>
              <p className="text-zinc-200">{ins.title}</p>
              <p className="text-[11px] text-zinc-600">{ins.description}</p>
            </li>
          ))}
        </ul>
      </DashboardCard>

      {engine.suggestedActions.length > 0 ? (
        <DashboardCard
          title="Ações sugeridas"
          status="ok"
          testId="mission-actions"
        >
          <ul className="space-y-2">
            {engine.suggestedActions.slice(0, 8).map((a) => (
              <li key={a.id} className="text-[12px]">
                <p className="text-zinc-200">{a.title}</p>
                <p className="text-[11px] text-zinc-600">
                  {a.reason}
                  {a.autoExecutable
                    ? " · auto seguro"
                    : " · nunca executa risco alto sozinho"}
                </p>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}
    </section>
  );
}

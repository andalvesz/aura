import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import {
  CompleteHabitButton,
  MyDayQuickBar,
  UpdateGoalProgressButton,
} from "@/components/dashboard/my-day-actions";
import { ActionButton } from "@/components/dashboard/action-button";
import { getAuraIntelligenceFromMyDay } from "@/lib/intelligence";
import { getAuraBrainForDashboard } from "@/lib/supabase/services/aura-brain-core.service";
import { AuraBrainActivityPanel } from "@/components/dashboard/aura-brain-activity";
import { getMyDaySummary } from "@/lib/supabase/services/my-day.service";
import { getMissionEngine } from "@/lib/supabase/services/mission.service";
import { formatOptionalMetric } from "@/lib/dashboard/context-dashboard";
import { formatBRL } from "@/utils/format";
import { resolveDashboardDisplayName } from "@/lib/dashboard/display-name";
import { getDataContext } from "@/lib/supabase/services/context";
import { DiscoveryDashboardSummary } from "@/components/dashboard/discovery/discovery-dashboard-summary";

const PRIORITY_STYLE = {
  CRITICAL: "text-rose-400",
  HIGH: "text-rose-300",
  MEDIUM: "text-amber-300",
  LOW: "text-zinc-500",
} as const;

export async function MyDay() {
  const ctx = await getDataContext();
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();

  const displayName = resolveDashboardDisplayName(
    profile?.full_name,
    ctx.user.email
  );
  const summary = await getMyDaySummary(displayName);
  const intel = await getAuraIntelligenceFromMyDay(ctx.userId, summary, {
    skipCache: process.env.NODE_ENV === "development",
  });
  const missions = await getMissionEngine({ intelligence: intel });
  // Analysis during render; automations run with cooldown/idempotency
  // Mission safe actions feed the Planner (never HIGH/CRITICAL auto)
  const { brain, activity } = await getAuraBrainForDashboard({
    runAutomations: true,
    intelligence: intel,
    missionActions: missions.automationProposals,
  });

  const saldo = formatOptionalMetric(
    summary.finance.data?.hasSaldo ? summary.finance.data.saldoAtual : null,
    formatBRL,
    "Defina o saldo"
  );

  const uniquePriorities = intel.priorities.filter(
    (p, i, arr) =>
      arr.findIndex(
        (x) => x.title === p.title && x.level === p.level && x.module === p.module
      ) === i
  );
  const uniqueAlerts = intel.alerts.filter(
    (a, i, arr) =>
      arr.findIndex((x) => x.title === a.title && x.type === a.type) === i
  );
  const uniqueRecs = intel.recommendations.filter(
    (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
  );

  return (
    <section className="space-y-4" data-testid="my-day" aria-labelledby="my-day-heading">
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Meu Dia
        </p>
        <h1 id="my-day-heading" className="text-lg font-semibold tracking-tight text-zinc-100">
          {summary.greeting}
        </h1>
        <p className="text-[13px] text-zinc-500">
          {summary.dateLabel} · {summary.narrative}
          {" · "}
          Índice {intel.score.overall}/100
        </p>
        {process.env.NODE_ENV === "development" ? (
          <p className="text-[10px] text-zinc-700">
            carregado em {summary.loadMs}ms · engine {intel.meta.executionMs}ms
            {intel.meta.cacheHit ? " · cache" : ""}
            {" · "}missions {missions.meta.totalMs}ms
          </p>
        ) : null}
      </header>

      <MyDayQuickBar />

      <DiscoveryDashboardSummary />

      {missions.missionOfTheDay ? (
        <DashboardCard
          title="Missão do dia"
          status="ok"
          href="/dashboard/missions"
          className="border-amber-500/20"
          testId="my-day-mission"
        >
          <p className="text-[13px] text-zinc-200" data-testid="mission-of-the-day-message">
            {missions.missionOfTheDay.message}
          </p>
          {missions.missionOfTheDay.nextTask ? (
            <p className="mt-1 text-[12px] text-zinc-500">
              Próxima tarefa: {missions.missionOfTheDay.nextTask.title}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-zinc-600">
              <Link href="/dashboard/missions" className="hover:text-zinc-300">
                Ver missões →
              </Link>
            </p>
          )}
        </DashboardCard>
      ) : (
        <DashboardCard
          title="Missão do dia"
          status="empty"
          href="/dashboard/missions"
          emptyTitle="Nenhuma missão ativa"
          emptyDescription="Crie uma missão quando quiser — o Aura ainda não executa decisões por você."
          emptyAction={
            <Link
              href="/dashboard/missions"
              className="text-[12px] text-zinc-400 hover:text-zinc-200"
            >
              Abrir Missões
            </Link>
          }
          testId="my-day-mission"
        />
      )}

      <AuraBrainActivityPanel brain={brain} activity={activity} />

      {/* Priorities from Intelligence Engine */}
      <DashboardCard
        title="O que fazer agora"
        status={uniquePriorities.length ? "ok" : "empty"}
        emptyTitle="Nada urgente"
        emptyDescription="Quando houver atrasos, treinos ou prazos, eles aparecem aqui."
        className="border-white/[0.08]"
        testId="my-day-priorities"
      >
        <ul className="space-y-2" data-testid="intelligence-priorities">
          {uniquePriorities.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 text-[12px]"
              data-priority-level={p.level}
              data-priority-module={p.module}
            >
              <div className="min-w-0">
                <p className="truncate text-zinc-200">{p.title}</p>
                <p className="text-[11px] text-zinc-600">{p.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={PRIORITY_STYLE[p.level]}>{p.level}</span>
                {p.target ? (
                  <Link
                    href={p.target}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300"
                  >
                    Abrir
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </DashboardCard>

      {(uniqueAlerts.length > 0 || uniqueRecs.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <DashboardCard
            title="Alertas"
            status={uniqueAlerts.length ? "ok" : "empty"}
            emptyTitle="Sem alertas"
            emptyDescription="Nenhum alerta crítico no momento."
            testId="intelligence-alerts"
          >
            <ul className="space-y-2">
              {uniqueAlerts.map((a) => (
                <li key={a.id} className="text-[12px]" data-alert-type={a.type}>
                  <p className="text-zinc-200">{a.title}</p>
                  <p className="text-[11px] text-zinc-600">{a.description}</p>
                  <p className={`text-[10px] ${PRIORITY_STYLE[a.severity]}`}>
                    {a.severity}
                  </p>
                </li>
              ))}
            </ul>
          </DashboardCard>

          <DashboardCard
            title="Recomendações"
            status={uniqueRecs.length ? "ok" : "empty"}
            emptyTitle="Sem recomendações"
            emptyDescription="Sugestões aparecem com base nos seus dados."
            testId="intelligence-recommendations"
          >
            <ul className="space-y-2">
              {uniqueRecs.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 text-[12px]">
                  <div className="min-w-0">
                    <p className="text-zinc-200">{r.title}</p>
                    <p className="text-[11px] text-zinc-600">{r.description}</p>
                  </div>
                  {r.target ? (
                    <Link
                      href={r.target}
                      className="shrink-0 text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      Abrir
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Agenda"
          status={summary.agenda.status}
          error={summary.agenda.error}
          emptyTitle="Sem eventos"
          emptyDescription="Crie um evento ou conecte o Google Calendar."
          emptyAction={
            <Link href="/dashboard/calendario">
              <ActionButton type="button">Abrir calendário</ActionButton>
            </Link>
          }
          href="/dashboard/calendario"
        >
          {summary.agenda.data ? (
            <div className="space-y-2 text-[12px] text-zinc-300">
              <p className="text-zinc-500">
                Google:{" "}
                {summary.agenda.data.google.status === "connected"
                  ? `conectado${summary.agenda.data.google.email ? ` (${summary.agenda.data.google.email})` : ""}`
                  : summary.agenda.data.google.status === "error"
                    ? "erro ao verificar"
                    : summary.agenda.data.google.configured
                      ? "desconectado"
                      : "não configurado"}
              </p>
              {summary.agenda.data.overdue.length > 0 ? (
                <div>
                  <p className="mb-1 text-[11px] text-rose-300">Atrasados</p>
                  {summary.agenda.data.overdue.slice(0, 3).map((e) => (
                    <p key={e.id}>
                      {e.data} — {e.titulo}
                    </p>
                  ))}
                </div>
              ) : null}
              {summary.agenda.data.today.map((e) => (
                <p key={e.id}>Hoje — {e.titulo}</p>
              ))}
              {summary.agenda.data.next7Days.slice(0, 4).map((e) => (
                <p key={e.id}>
                  {e.data} — {e.titulo}
                </p>
              ))}
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Hábitos"
          status={summary.habits.status}
          error={summary.habits.error}
          emptyTitle="Nenhum hábito"
          emptyDescription="Registre hábitos no módulo Saúde."
          emptyAction={
            <Link href="/dashboard/saude">
              <ActionButton type="button">Abrir Saúde</ActionButton>
            </Link>
          }
          href="/dashboard/saude"
        >
          {summary.habits.data ? (
            <div className="space-y-2 text-[12px]">
              <p className="text-zinc-500">
                Sequência: {summary.habits.data.streakDays} dia(s) · Progresso
                hoje: {summary.habits.data.dailyProgressPct}%
              </p>
              {summary.habits.data.pending.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 text-zinc-300"
                >
                  <span className="truncate">{h.titulo}</span>
                  <CompleteHabitButton habitId={h.id} />
                </div>
              ))}
              {summary.habits.data.completedToday.length > 0 ? (
                <p className="text-[11px] text-emerald-400/80">
                  Concluídos hoje:{" "}
                  {summary.habits.data.completedToday.map((h) => h.titulo).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Saúde"
          status={summary.health.status}
          error={summary.health.error}
          emptyTitle="Rotina de saúde vazia"
          emptyDescription="Registre treino, refeições, leitura ou meditação."
          emptyAction={
            <Link href="/dashboard/saude">
              <ActionButton type="button">Criar treino</ActionButton>
            </Link>
          }
          href="/dashboard/saude"
        >
          {summary.health.data ? (
            <div className="space-y-1.5 text-[12px] text-zinc-300">
              <p>
                Treino:{" "}
                {summary.health.data.workout
                  ? `${summary.health.data.workout.nome} (${summary.health.data.workout.duracaoMin} min)`
                  : "pendente"}
              </p>
              {!summary.health.data.workout ? (
                <Link href="/dashboard/saude">
                  <ActionButton type="button" variant="ghost">
                    Criar treino
                  </ActionButton>
                </Link>
              ) : null}
              <p>
                Dieta hoje:{" "}
                {summary.health.data.meals.length
                  ? summary.health.data.meals
                      .map((m) => `${m.horario} ${m.nome}`)
                      .join(" · ")
                  : "sem refeições"}
              </p>
              <p className="text-zinc-600">{summary.health.data.waterNote}</p>
              {summary.health.data.leitura ? (
                <p>Leitura: {summary.health.data.leitura.titulo}</p>
              ) : null}
              {summary.health.data.meditacao ? (
                <p>Meditação: {summary.health.data.meditacao.titulo}</p>
              ) : null}
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Financeiro"
          status={summary.finance.status}
          error={summary.finance.error}
          emptyTitle="Sem dados financeiros"
          emptyDescription="Defina saldo e registre movimentações."
          emptyAction={
            <Link href="/dashboard/financeiro">
              <ActionButton type="button">Abrir Financeiro</ActionButton>
            </Link>
          }
          href="/dashboard/financeiro"
        >
          {summary.finance.data ? (
            <div className="space-y-2 text-[12px]">
              <dl className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-zinc-500">Saldo</dt>
                  <dd className="text-zinc-100">{saldo.display}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Gasto hoje</dt>
                  <dd className="text-zinc-100">
                    {formatBRL(summary.finance.data.gastoHoje)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Gasto mês</dt>
                  <dd className="text-zinc-100">
                    {formatBRL(summary.finance.data.gastoMes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Orçamento restante</dt>
                  <dd className="text-zinc-100">
                    {summary.finance.data.orcamentoRestante != null
                      ? formatBRL(summary.finance.data.orcamentoRestante)
                      : "—"}
                  </dd>
                </div>
              </dl>
              {summary.finance.data.budgetAlert ? (
                <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-200">
                  Alerta de orçamento / despesas.
                </p>
              ) : null}
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Objetivos"
          status={summary.goals.status}
          error={summary.goals.error}
          emptyTitle="Nenhum objetivo ativo"
          emptyDescription="Crie um objetivo para acompanhar progresso."
          emptyAction={
            <Link href="/dashboard/metas">
              <ActionButton type="button">Abrir Objetivos</ActionButton>
            </Link>
          }
          href="/dashboard/metas"
        >
          {summary.goals.data?.priority ? (
            <div className="space-y-2 text-[12px] text-zinc-300">
              <p className="font-medium text-zinc-100">
                {summary.goals.data.priority.titulo}
              </p>
              <p>{summary.goals.data.priority.progressLabel}</p>
              <p className="text-zinc-500">
                Prazo {summary.goals.data.priority.prazo} ·{" "}
                {summary.goals.data.priority.remainingDays} dia(s)
              </p>
              <UpdateGoalProgressButton
                goalId={summary.goals.data.priority.id}
                current={summary.goals.data.priority.atual}
                meta={summary.goals.data.priority.meta}
              />
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Viagens"
          status={summary.travel.status}
          error={summary.travel.error}
          emptyTitle="Nenhuma viagem planejada"
          emptyDescription="Planeje uma viagem no módulo Viagens."
          emptyAction={
            <Link href="/dashboard/viagens">
              <ActionButton type="button">Abrir Viagens</ActionButton>
            </Link>
          }
          href="/dashboard/viagens"
        >
          {summary.travel.data?.trip ? (
            <div className="space-y-1.5 text-[12px] text-zinc-300">
              <p className="font-medium text-zinc-100">
                {summary.travel.data.trip.titulo}
              </p>
              <p>{summary.travel.data.trip.countdownLabel}</p>
              <p>Checklist: {summary.travel.data.trip.checklistPct}%</p>
              {summary.travel.data.trip.nextChecklist ? (
                <p className="text-zinc-500">
                  Próximo: {summary.travel.data.trip.nextChecklist}
                </p>
              ) : null}
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Idiomas"
          status={summary.language.status}
          error={summary.language.error}
          emptyTitle="Idioma não configurado"
          emptyDescription="Inicie uma sessão no módulo Idiomas."
          emptyAction={
            <Link href="/dashboard/idiomas">
              <ActionButton type="button">Iniciar sessão</ActionButton>
            </Link>
          }
          href="/dashboard/idiomas"
        >
          {summary.language.data ? (
            <div className="space-y-2 text-[12px] text-zinc-300">
              {summary.language.data.progress ? (
                <>
                  <p>{summary.language.data.progress.modoLabel}</p>
                  <p>
                    Sequência: {summary.language.data.progress.streak} dia(s)
                    {summary.language.data.progress.nivel
                      ? ` · ${summary.language.data.progress.nivel}`
                      : ""}
                  </p>
                </>
              ) : null}
              {summary.language.data.nextSession ? (
                <p>
                  Sessão: {summary.language.data.nextSession.titulo} (
                  {summary.language.data.nextSession.status})
                </p>
              ) : null}
              <Link href="/dashboard/idiomas">
                <ActionButton type="button">Iniciar sessão</ActionButton>
              </Link>
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Expert Brain"
          status={summary.expertBrain.status}
          error={summary.expertBrain.error}
          emptyTitle="Expert Brain vazio"
          emptyDescription="Importe conteúdos quando quiser — sem processamento automático aqui."
          emptyAction={
            <Link href="/dashboard/expert-brain">
              <ActionButton type="button">Abrir Expert Brain</ActionButton>
            </Link>
          }
          href="/dashboard/expert-brain"
        >
          {summary.expertBrain.data ? (
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <dt className="text-zinc-500">Documentos</dt>
                <dd className="text-zinc-100">
                  {summary.expertBrain.data.documents}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Fila</dt>
                <dd className="text-zinc-100">
                  {summary.expertBrain.data.pending}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Processando</dt>
                <dd className="text-zinc-100">
                  {summary.expertBrain.data.processing}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Erros</dt>
                <dd className="text-zinc-100">
                  {summary.expertBrain.data.errors}
                </dd>
              </div>
            </dl>
          ) : null}
        </DashboardCard>
      </div>
    </section>
  );
}

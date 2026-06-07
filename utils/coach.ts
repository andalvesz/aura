import type { ExecutiveReportData } from "@/utils/executive-reports";
import {
  formatReportGreeting,
  getWeekRange,
  isInDateRange,
} from "@/utils/executive-reports";
import { formatBRL, formatDate, formatTime, isToday } from "@/utils/format";
import {
  computeSmartFinanceStats,
  filterIncomeCurrentMonth,
  isGoalBehind,
} from "@/utils/finance";
import {
  analyzeGrowthLeadContentInsights,
  buildExecutivePriorities,
  computeGrowthLeadMetrics,
  computeMonthlyExecutiveScore,
  detectExecutiveAlerts,
  getGrowthLeadStatusLabel,
  getTodayDate,
  mergeDailyMissions,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import {
  computeHealthMetrics,
  todayIsoDate,
  workoutForToday,
  workoutsThisWeek,
} from "@/utils/health";
import { listStaleOpportunities } from "@/utils/follow-up";
import {
  computeAlveszMetrics,
  filterUpcomingEventos,
} from "@/utils/nexus";
import {
  computeSocialMetrics,
  getConteudoStatusLabel,
  getFormatoLabel,
  getSocialGrowthHints,
  normalizeConteudoStatus,
} from "@/utils/social";
import {
  buildGoalsSummaryLines,
  computeGoalMetrics,
  findMostDelayedGoal,
  formatGoalForecast,
  getActiveGoals,
  GOAL_TIPO_LABELS,
  isGoalBehind as isAuraGoalBehind,
  sortGoalsByUrgency,
} from "@/utils/goals";
import {
  formatXpRemaining,
  getStreakDisplay,
} from "@/utils/xp";
import { buildImportantNotificationsSummary } from "@/utils/notifications";
import { isPostTodayQuery, MARCA_LABELS } from "@/utils/instagram";
import {
  buildCoachNowResponse,
  type DailyOperationsInput,
} from "@/utils/daily-operations";

export type CoachMode =
  | "today"
  | "now"
  | "executive-week"
  | "performance"
  | "alerts"
  | "opportunity"
  | "goals"
  | "goals-late"
  | "post-today"
  | "xp-level"
  | "xp-progress"
  | "xp-missions"
  | "important-today"
  | "intro";

export const AURA_COACH_ACTION_ID = "aura-coach";

export const AURA_COACH_PERSONALITY = `Você é a Aura Coach — mentor pessoal e executivo do Anderson Alves.
Tom: profissional, mentor, objetivo e motivador. Português do Brasil.
Use apenas dados reais fornecidos. Nunca invente valores, nomes ou compromissos.
Seja direto, empático e orientado a ação — como um CEO coach pessoal.`;

const TODAY_PHRASES = [
  "o que devo fazer hoje",
  "o que fazer hoje",
  "o que tenho hoje",
  "prioridades de hoje",
  "meu dia",
  "plano do dia",
] as const;

const NOW_PHRASES = [
  "o que devo fazer agora",
  "o que fazer agora",
  "qual minha prioridade agora",
  "proximo passo",
  "próximo passo",
] as const;

const WEEK_PHRASES = [
  "como esta minha semana",
  "como está minha semana",
  "minha semana",
  "panorama da semana",
  "resumo da semana",
] as const;

const ROUTINE_PHRASES = [
  "como esta minha rotina",
  "como está minha rotina",
  "minha rotina",
  "como estou na rotina",
  "performance da rotina",
] as const;

const FOCUS_PHRASES = [
  "onde devo focar",
  "onde focar",
  "prioridade agora",
  "o que priorizar",
  "foco esta semana",
] as const;

const ALERT_PHRASES = [
  "alertas",
  "o que precisa de atencao",
  "o que precisa de atenção",
  "riscos",
  "problemas",
] as const;

const GOALS_PHRASES = [
  "como estao minhas metas",
  "como estão minhas metas",
  "minhas metas",
  "progresso das metas",
  "status das metas",
] as const;

const GOALS_LATE_PHRASES = [
  "qual meta esta mais atrasada",
  "qual meta está mais atrasada",
  "meta mais atrasada",
  "meta atrasada",
] as const;

const XP_LEVEL_PHRASES = [
  "qual meu nivel",
  "qual meu nível",
  "meu nivel",
  "meu nível",
  "nivel atual",
  "nível atual",
] as const;

const XP_PROGRESS_PHRASES = [
  "quanto falta para subir",
  "quanto falta pro proximo nivel",
  "quanto falta pro próximo nível",
  "falta quanto xp",
  "progresso de xp",
  "barra de xp",
] as const;

const XP_MISSIONS_PHRASES = [
  "quais missoes faltam",
  "quais missões faltam",
  "missoes diarias",
  "missões diárias",
  "o que falta hoje",
  "missoes do dia",
  "missões do dia",
] as const;

const IMPORTANT_TODAY_PHRASES = [
  "tenho algo importante hoje",
  "algo importante hoje",
  "avisos importantes",
  "notificacoes importantes",
  "notificações importantes",
  "alertas importantes",
  "o que precisa da minha atencao hoje",
  "o que precisa da minha atenção hoje",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export function detectCoachMode(
  message: string,
  actionId?: string
): CoachMode | null {
  if (actionId === AURA_COACH_ACTION_ID) return "today";

  const normalized = normalize(message);
  if (!normalized) return null;

  if (isPostTodayQuery(message)) return "post-today";

  if (actionId === "o-que-fazer" || matchesAny(normalized, TODAY_PHRASES)) {
    return "today";
  }
  if (matchesAny(normalized, NOW_PHRASES)) return "now";
  if (matchesAny(normalized, WEEK_PHRASES)) return "executive-week";
  if (matchesAny(normalized, ROUTINE_PHRASES)) return "performance";
  if (matchesAny(normalized, GOALS_LATE_PHRASES)) return "goals-late";
  if (matchesAny(normalized, GOALS_PHRASES)) return "goals";
  if (matchesAny(normalized, XP_LEVEL_PHRASES)) return "xp-level";
  if (matchesAny(normalized, XP_PROGRESS_PHRASES)) return "xp-progress";
  if (matchesAny(normalized, XP_MISSIONS_PHRASES)) return "xp-missions";
  if (matchesAny(normalized, IMPORTANT_TODAY_PHRASES)) return "important-today";
  if (matchesAny(normalized, FOCUS_PHRASES)) return "opportunity";
  if (matchesAny(normalized, ALERT_PHRASES)) return "alerts";

  if (normalized.includes("aura coach")) {
    return normalized.length < 24 ? "intro" : "today";
  }

  return null;
}

function lineOrFallback(lines: string[], fallback: string): string {
  return lines.length > 0 ? lines.map((l) => `• ${l}`).join("\n") : `• ${fallback}`;
}

export function detectCoachAlerts(data: ExecutiveReportData): string[] {
  const alerts: string[] = [];
  const today = todayIsoDate();
  const { start, end } = getWeekRange();

  for (const item of listStaleOpportunities({
    leads: data.leads,
    orcamentos: data.orcamentos,
    clientes: data.clientes,
  }).slice(0, 5)) {
    alerts.push(
      `Lead parado: ${item.context.nome} — ${item.context.tipoEvento} (${formatBRL(item.context.valor)})`
    );
  }

  const growthGoal = data.goal;
  if (growthGoal && growthGoal.meta_receita_mensal > 0) {
    const pct =
      growthGoal.meta_receita_mensal > 0
        ? Math.round(
            ((growthGoal.receita_atual ?? 0) / growthGoal.meta_receita_mensal) * 100
          )
        : 0;
    const dayOfMonth = new Date().getDate();
    const expectedPct = Math.round((dayOfMonth / 30) * 100);
    if (pct < expectedPct - 15) {
      alerts.push(
        `Meta de receita atrasada: ${pct}% da meta mensal (esperado ~${expectedPct}% neste ponto do mês).`
      );
    }
  }

  const financeStats = computeSmartFinanceStats({
    gastos: data.gastos,
    income: data.financialIncome,
    goals: data.financialGoals,
    initialBalance: data.financialBalance?.valor_atual ?? null,
  });

  if (financeStats.activeGoal && isGoalBehind(financeStats.activeGoal)) {
    alerts.push(`Meta financeira atrasada: "${financeStats.activeGoal.titulo}".`);
  }

  for (const goal of getActiveGoals(data.goals).filter((g) => isAuraGoalBehind(g)).slice(0, 3)) {
    const m = computeGoalMetrics(goal);
    alerts.push(`Meta atrasada: ${goal.titulo} (${GOAL_TIPO_LABELS[goal.tipo]}, ${m.pct}%).`);
  }

  if (financeStats.expenseAlert.unusual) {
    alerts.push("Gasto excessivo: despesas do mês acima da sua média recente.");
  }

  const contentThisWeek = data.conteudos.filter(
    (c) =>
      normalizeConteudoStatus(c.status) === "publicado" &&
      isInDateRange(c.data_publicacao ?? c.updated_at, start, end)
  );
  if (data.conteudos.length > 0 && contentThisWeek.length === 0) {
    alerts.push("Semana sem conteúdo publicado — retome Social Media.");
  }

  const workoutsWeek = workoutsThisWeek(data.healthWorkouts);
  if (data.healthWorkouts.length > 0 && workoutsWeek.length === 0) {
    alerts.push("Treino não realizado esta semana — retome Saúde.");
  } else if (!workoutForToday(data.healthWorkouts) && data.healthWorkouts.length > 0) {
    alerts.push("Nenhum treino registrado hoje.");
  }

  const habitsPending = data.healthHabits.filter(
    (h) => h.data === today && h.status !== "concluido"
  );
  if (habitsPending.length > 0) {
    alerts.push(`${habitsPending.length} hábito(s) pendente(s) hoje.`);
  }

  return alerts;
}

export function buildCoachTodayResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const today = todayIsoDate();
  const eventsToday = filterUpcomingEventos(data.eventos, 1).filter((e) =>
    isToday(e.data_inicio.slice(0, 10))
  );
  const upcomingEvents = filterUpcomingEventos(data.eventos, 7).slice(0, 6);

  const priorityLeads = sortGrowthLeadOpportunities(
    data.leads.filter((l) => l.status !== "fechado" && l.status !== "perdido")
  ).slice(0, 5);

  const missions = mergeDailyMissions(data.missions);
  const pendingMissions = missions.filter((m) => m.status === "pending");

  const habitsPending = data.healthHabits.filter(
    (h) => h.data === today && h.status !== "concluido"
  );

  const contentPending = data.conteudos.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );

  const eventLines =
    eventsToday.length > 0
      ? eventsToday.map(
          (e) =>
            `${formatTime(e.data_inicio)} — ${e.titulo}${e.local ? ` (${e.local})` : ""}`
        )
      : upcomingEvents.length > 0
        ? upcomingEvents.slice(0, 3).map((e) => {
            const label = isToday(e.data_inicio.slice(0, 10))
              ? "Hoje"
              : formatDate(e.data_inicio);
            return `${label} ${formatTime(e.data_inicio)} — ${e.titulo}`;
          })
        : [];

  const leadLines = priorityLeads.map(
    (l) =>
      `${l.nome} — ${getGrowthLeadStatusLabel(l.status)} — ${formatBRL(l.valor_potencial ?? 0)}`
  );

  const missionLines = pendingMissions.map((m) => `${m.titulo} (+${m.xp} XP)`);

  const habitLines = habitsPending.map((h) => `${h.titulo} (${h.frequencia})`);

  const contentLines = contentPending
    .slice(0, 5)
    .map((c) => `${c.titulo} — ${c.plataforma} · ${getConteudoStatusLabel(c.status)}`);

  const alerts = detectCoachAlerts(data);
  const alertBlock =
    alerts.length > 0
      ? `\n\n⚠️ **Alertas**\n${alerts.map((a) => `• ${a}`).join("\n")}`
      : "";

  return `${formatReportGreeting(displayName)}

Sou sua **Aura Coach**. Aqui está seu plano para **${getTodayDate()}**:

**1. Compromissos**
${lineOrFallback(eventLines, "Nenhum compromisso hoje — use a agenda para bloquear foco.")}

**2. Leads prioritários**
${lineOrFallback(leadLines, "Nenhum lead ativo — cadastre oportunidades no Crescimento.")}

**3. Tarefas pendentes**
${lineOrFallback(missionLines, "Missões do dia concluídas ou nenhuma cadastrada.")}

**4. Hábitos pendentes**
${lineOrFallback(habitLines, "Hábitos de hoje concluídos ou nenhum cadastrado.")}

**5. Conteúdos pendentes**
${lineOrFallback(contentLines, "Nenhum conteúdo pendente — ótimo para planejar o próximo post.")}${alertBlock}

**Próximo passo:** comece pelo item de maior impacto comercial — follow-up ou compromisso mais cedo do dia.`;
}

export function buildCoachExecutiveWeekResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const { start, end } = getWeekRange();
  const metrics = computeGrowthLeadMetrics(data.leads);
  const alvesz = computeAlveszMetrics(data.orcamentos);
  const monthIncome = filterIncomeCurrentMonth(data.financialIncome);
  const receitaFechada = monthIncome.reduce((s, i) => s + Number(i.valor), 0);
  const receitaPrevista =
    (data.goal?.meta_receita_mensal ?? 0) > 0
      ? data.goal!.meta_receita_mensal
      : metrics.receitaPotencial;

  const weekEvents = [
    ...filterUpcomingEventos(data.eventos, 14),
    ...data.alveszEventos.filter((e) =>
      e.data_evento ? isInDateRange(e.data_evento, start, end) : false
    ),
  ];

  const activeLeads = data.leads.filter(
    (l) => l.status !== "fechado" && l.status !== "perdido"
  );
  const topLeads = sortGrowthLeadOpportunities(activeLeads).slice(0, 5);

  const metaMensal = data.goal?.meta_receita_mensal ?? 0;
  const receitaAtual = data.goal?.receita_atual ?? metrics.receita;
  const score = computeMonthlyExecutiveScore(data.missions, data.leads);

  return `${formatReportGreeting(displayName)}

**Modo executivo — sua semana** (${formatDate(start)} a ${formatDate(end)})

**Receita prevista:** ${formatBRL(receitaPrevista)}
**Receita fechada (mês):** ${formatBRL(receitaFechada)} · CRM: ${formatBRL(receitaAtual)}

**Eventos**
• ${weekEvents.length} compromisso(s) / evento(s) na semana
• Pipeline Alvesz: ${alvesz.pendentes} orçamento(s) pendente(s) (${formatBRL(alvesz.pipelinePendente)})

**Leads**
• ${activeLeads.length} lead(s) ativo(s) · ${metrics.fechados} fechado(s) no mês
${lineOrFallback(
  topLeads.map(
    (l) => `${l.nome} — ${getGrowthLeadStatusLabel(l.status)} — ${formatBRL(l.valor_potencial ?? 0)}`
  ),
  "Cadastre leads para acompanhar o pipeline."
)}

**Metas**
• Meta mensal: ${metaMensal > 0 ? formatBRL(metaMensal) : "não definida"}
• Progresso: ${metaMensal > 0 ? `${Math.round((receitaAtual / metaMensal) * 100)}%` : "—"}
• Score executivo: ${score}/100

Mantenha o ritmo comercial: feche follow-ups pendentes e confirme eventos da semana.`;
}

export function buildCoachPerformanceResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const metrics = computeHealthMetrics(
    data.healthHabits,
    data.healthWorkouts,
    data.healthSessions
  );
  const today = todayIsoDate();
  const habitsToday = data.healthHabits.filter((h) => h.data === today);
  const habitsPending = habitsToday.filter((h) => h.status !== "concluido");
  const habitsDone = habitsToday.filter((h) => h.status === "concluido");
  const workoutsWeek = workoutsThisWeek(data.healthWorkouts);
  const workoutToday = workoutForToday(data.healthWorkouts);

  const readings = data.healthSessions.filter((s) => s.tipo === "leitura");
  const meditations = data.healthSessions.filter((s) => s.tipo === "meditacao");
  const { start, end } = getWeekRange();
  const readingsWeek = readings.filter((s) => isInDateRange(s.data, start, end));
  const meditationsWeek = meditations.filter((s) =>
    isInDateRange(s.data, start, end)
  );

  return `${formatReportGreeting(displayName)}

**Modo performance — sua rotina**

**Hábitos**
• Hoje: ${habitsDone.length} concluído(s) · ${habitsPending.length} pendente(s)
• Ativos no sistema: ${metrics.habitsAtivos}
${lineOrFallback(
  habitsPending.map((h) => h.titulo),
  "Nenhum hábito pendente hoje."
)}

**Treinos**
• Esta semana: ${workoutsWeek.length} treino(s)
• Hoje: ${workoutToday ? `${workoutToday.nome} (${workoutToday.grupo_muscular}, ${workoutToday.duracao_min} min)` : "nenhum registrado"}

**Leituras**
• Total registrado: ${readings.length} · Esta semana: ${readingsWeek.length}

**Meditações**
• Total registrado: ${meditations.length} · Esta semana: ${meditationsWeek.length}

Consistência constrói performance. Priorize o hábito ou treino pendente de maior impacto energético hoje — respeitando a recuperação do ombro.`;
}

export function buildCoachOpportunityResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const metrics = computeGrowthLeadMetrics(data.leads);
  const alvesz = computeAlveszMetrics(data.orcamentos);
  const social = computeSocialMetrics(data.conteudos);
  const contentInsights = analyzeGrowthLeadContentInsights(data.leads);
  const priorities = buildExecutivePriorities(
    data.leads,
    data.missions,
    contentInsights,
    data.orcamentos
  );

  const focusAreas: { rank: number; area: string; action: string; score: number }[] = [];

  const metaGap = Math.max(0, (data.goal?.meta_receita_mensal ?? 0) - (data.goal?.receita_atual ?? 0));
  focusAreas.push({
    rank: 1,
    area: "Receita",
    action:
      metaGap > 0
        ? `Faltam ${formatBRL(metaGap)} para a meta — converta negociações em fechamento.`
        : metrics.receitaPotencial > 0
          ? `Receita potencial no CRM: ${formatBRL(metrics.receitaPotencial)}.`
          : "Defina meta mensal e registre receitas no Financeiro.",
    score: metaGap + metrics.receitaEmNegociacao,
  });

  const staleTop = listStaleOpportunities({
    leads: data.leads,
    orcamentos: data.orcamentos,
    clientes: data.clientes,
  })[0];
  focusAreas.push({
    rank: 2,
    area: "Leads",
    action: staleTop
      ? `Follow-up com ${staleTop.context.nome} (${formatBRL(staleTop.context.valor)}).`
      : priorities[0] ?? "Prospecte 2–3 leads qualificados hoje.",
    score: staleTop?.context.valor ?? metrics.receitaEmNegociacao,
  });

  focusAreas.push({
    rank: 3,
    area: "Eventos",
    action:
      alvesz.pendentes > 0
        ? `${alvesz.pendentes} orçamento(s) Alvesz em pipeline (${formatBRL(alvesz.pipelinePendente)}).`
        : "Agende reuniões com clientes ou bloqueie tempo de produção.",
    score: alvesz.pipelinePendente,
  });

  const habitsPending = data.healthHabits.filter(
    (h) => h.data === todayIsoDate() && h.status !== "concluido"
  ).length;
  focusAreas.push({
    rank: 4,
    area: "Saúde",
    action:
      habitsPending > 0 || !workoutForToday(data.healthWorkouts)
        ? "Complete hábitos pendentes ou registre treino de hoje."
        : "Rotina de saúde em dia — mantenha consistência.",
    score: habitsPending * 100,
  });

  const pendingContent = social.normalized.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  ).length;
  focusAreas.push({
    rank: 5,
    area: "Conteúdo",
    action:
      pendingContent > 0
        ? `${pendingContent} conteúdo(s) pendente(s) — produza ou agende publicação.`
        : "Planeje o próximo conteúdo para @and.alvesz.",
    score: pendingContent * 50,
  });

  const delayedGoal = findMostDelayedGoal(data.goals);
  if (delayedGoal) {
    const m = computeGoalMetrics(delayedGoal);
    focusAreas.push({
      rank: 0,
      area: "Metas",
      action: `Meta atrasada: ${delayedGoal.titulo} (${m.pct}% — faltam ${m.remainingDays} dias).`,
      score: (100 - m.pct) * 1000 + m.remaining,
    });
  }

  const sorted = [...focusAreas].sort((a, b) => b.score - a.score);
  const top = sorted[0];

  return `${formatReportGreeting(displayName)}

**Onde focar agora**

Prioridade calculada com base nos seus dados reais:

${sorted
  .map(
    (f, i) =>
      `${i + 1}. **${f.area}** — ${f.action}`
  )
  .join("\n")}

**Recomendação imediata:** ${top.area} — ${top.action}

Execute uma ação concreta nos próximos 30 minutos e registre o progresso na Aura.`;
}

export function buildCoachAlertsResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const alerts = detectCoachAlerts(data);

  if (alerts.length === 0) {
    return `${formatReportGreeting(displayName)}

**Modo alertas**

Nenhum alerta crítico no momento. Continue executando o plano do dia com disciplina.`;
  }

  return `${formatReportGreeting(displayName)}

**Modo alertas — ${alerts.length} ponto(s) de atenção**

${alerts.map((a) => `• ${a}`).join("\n")}

Trate o primeiro item da lista ainda hoje. Pequenas correções evitam gargalos na semana.`;
}

export function buildCoachGoalsResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const active = sortGoalsByUrgency(getActiveGoals(data.goals));
  const lines = buildGoalsSummaryLines(data.goals);

  if (active.length === 0) {
    return `${formatReportGreeting(displayName)}

**Suas metas**

Nenhuma meta ativa no momento. Cadastre em **Metas** — financeiras, saúde, conteúdo, vendas ou eventos.

O progresso é atualizado automaticamente com dados reais da Aura.`;
  }

  const details = active.slice(0, 5).map((g) => {
    const m = computeGoalMetrics(g);
    const behind = isAuraGoalBehind(g) ? " (atrasada)" : "";
    return `• **${g.titulo}** (${GOAL_TIPO_LABELS[g.tipo]}) — ${m.pct}%${behind}\n  ${formatGoalForecast(g)}`;
  });

  return `${formatReportGreeting(displayName)}

**Como estão suas metas**

${lines.map((l) => `• ${l}`).join("\n")}

**Detalhes**
${details.join("\n")}

Mantenha o ritmo nas metas atrasadas — pequenas ações diárias fecham a diferença.`;
}

export function buildCoachGoalsLateResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const delayed = findMostDelayedGoal(data.goals);

  if (!delayed) {
    return `${formatReportGreeting(displayName)}

**Meta mais atrasada**

Nenhuma meta ativa está significativamente atrasada. Continue executando o plano atual.`;
  }

  const m = computeGoalMetrics(delayed);
  const remaining =
    delayed.tipo === "financeira"
      ? formatBRL(m.remaining)
      : String(m.remaining);

  return `${formatReportGreeting(displayName)}

**Meta mais atrasada**

**${delayed.titulo}** (${GOAL_TIPO_LABELS[delayed.tipo]})

• Progresso: ${m.pct}% (${m.atual} de ${m.meta})
• Restante: ${remaining}
• Tempo do período: ${m.timePct}% decorrido
• ${formatGoalForecast(delayed)}

**Ação recomendada:** dedique foco a esta meta nos próximos dias — é onde o gap entre ritmo e prazo é maior.`;
}

export function buildCoachPostTodayResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const today = todayIsoDate();
  const pending = data.conteudos.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );
  const scheduledToday = pending.filter(
    (c) => c.data_publicacao?.slice(0, 10) === today
  );
  const contentInsights = analyzeGrowthLeadContentInsights(data.leads);
  const hints = getSocialGrowthHints(contentInsights);

  const scheduledLines =
    scheduledToday.length > 0
      ? scheduledToday.map(
          (c) =>
            `• ${c.titulo} (${getFormatoLabel(c.formato)}${c.marca ? ` — ${MARCA_LABELS[c.marca as keyof typeof MARCA_LABELS] ?? c.marca}` : ""})`
        )
      : [];

  const topPending = pending
    .filter((c) => !scheduledToday.includes(c))
    .slice(0, 3)
    .map(
      (c) =>
        `• ${c.titulo} — ${getConteudoStatusLabel(normalizeConteudoStatus(c.status))}`
    );

  const goalHint =
    getActiveGoals(data.goals).find((g) => g.tipo === "conteudo") ??
    getActiveGoals(data.goals)[0];
  const goalLine = goalHint
    ? `Meta de conteúdo: ${goalHint.titulo} (${computeGoalMetrics(goalHint).pct}%)`
    : null;

  const recommendation =
    scheduledToday.length > 0
      ? `Publique hoje: **${scheduledToday[0]!.titulo}** — já está no calendário.`
      : hints[0]
        ? `Priorize conteúdo alinhado ao CRM: ${hints[0]}`
        : topPending.length > 0
          ? `Avance no pipeline: **${pending[0]!.titulo}** (grave ou publique).`
          : "Gere ideias no Instagram Inteligente com base nos seus leads e metas.";

  return `${formatReportGreeting(displayName)}

**O que postar hoje**

${goalLine ? `${goalLine}\n\n` : ""}${scheduledLines.length > 0 ? `**Agendado para hoje**\n${scheduledLines.join("\n")}\n\n` : ""}${topPending.length > 0 ? `**Pipeline prioritário**\n${topPending.join("\n")}\n\n` : ""}${hints.length > 0 ? `**Insights do CRM**\n${hints.map((h) => `• ${h}`).join("\n")}\n\n` : ""}**Recomendação:** ${recommendation}

Abra **Social Media → Instagram Inteligente** para gerar roteiro com IA.`;
}

export function buildCoachIntroResponse(displayName = "Anderson"): string {
  return `${formatReportGreeting(displayName)}

Sou sua **Aura Coach** — mentor pessoal e executivo da Aura OS.

Posso analisar seus dados reais e orientar decisões. Experimente:

• **"O que devo fazer agora?"** — ação imediata com base nas prioridades do momento
• **"O que devo fazer hoje?"** — compromissos, leads, tarefas, hábitos e conteúdos
• **"Como está minha semana?"** — receita, eventos, leads e metas
• **"Como está minha rotina?"** — hábitos, treinos, leituras e meditações
• **"O que devo postar hoje?"** — sugestão com dados reais do calendário e CRM
• **"Como estão minhas metas?"** — progresso de todas as metas ativas
• **"Qual meta está mais atrasada?"** — foco na meta com maior gap
• **"Onde devo focar?"** — priorização automática por impacto
• **"Alertas"** — leads parados, metas atrasadas e riscos

Estou pronta quando você estiver.`;
}

function reportDataToDailyInput(data: ExecutiveReportData): DailyOperationsInput {
  return {
    eventos: data.eventos,
    growthLeads: data.leads,
    orcamentos: data.orcamentos,
    gastos: data.gastos,
    financialIncome: data.financialIncome,
    financialGoals: data.financialGoals,
    financialBalance: data.financialBalance?.valor_atual ?? null,
    healthHabits: data.healthHabits,
    healthWorkouts: data.healthWorkouts,
    goals: data.goals,
  };
}

export function buildCoachNowResponseFromReport(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  return buildCoachNowResponse(reportDataToDailyInput(data), displayName);
}

export function buildCoachXpLevelResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const xp = data.auraXp;
  if (!xp) {
    return `${displayName}, seu progresso Aura XP ainda não está disponível. Use a Aura hoje para começar a acumular XP.`;
  }

  const streakLine =
    xp.userXp.streak_dias > 0
      ? `Streak: ${xp.userXp.streak_dias} dia(s) ${getStreakDisplay(xp.userXp.streak_dias)}`
      : "Streak: comece hoje com uma ação na Aura.";

  return `${displayName}, você está no **nível ${xp.progress.level}** com **${xp.userXp.xp_total} XP** total.
${streakLine}
Continue registrando finanças, hábitos e follow-ups para evoluir.`;
}

export function buildCoachXpProgressResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const xp = data.auraXp;
  if (!xp) {
    return `${displayName}, não encontrei seus dados de XP. Faça uma ação na Aura hoje para iniciar o progresso.`;
  }

  const remaining = formatXpRemaining(xp.userXp.xp_total);
  if (remaining <= 0) {
    return `${displayName}, você já passou do último marco definido — **${xp.userXp.xp_total} XP** no nível **${xp.progress.level}**. Mantenha o ritmo diário.`;
  }

  return `${displayName}, faltam **${remaining} XP** para o nível **${xp.progress.level + 1}**.
Progresso atual: **${xp.progress.xpInLevel}/${xp.progress.xpNeeded} XP** neste nível (${xp.progress.pct}%).
Próximo passo: complete uma missão diária pendente.`;
}

export function buildCoachXpMissionsResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  const xp = data.auraXp;
  if (!xp) {
    return `${displayName}, suas missões diárias aparecerão assim que você começar a usar a Aura hoje.`;
  }

  const pending = xp.dailyMissions.filter((m) => !m.done);
  const done = xp.dailyMissions.filter((m) => m.done);

  const pendingLines =
    pending.length > 0
      ? pending.map((m) => `• ${m.label}`).join("\n")
      : "• Nenhuma — você completou todas as missões de hoje.";

  const doneLine =
    done.length > 0 ? done.map((m) => m.label).join(", ") : "nenhuma ainda";

  return `${displayName}, missões diárias de hoje:

**Faltam:**
${pendingLines}

**Concluídas:** ${doneLine}

Foque primeiro em follow-up ou finanças — são as de maior impacto no seu dia.`;
}

export function buildCoachImportantTodayResponse(
  data: ExecutiveReportData,
  displayName = "Anderson"
): string {
  return buildImportantNotificationsSummary(data.notifications ?? [], displayName);
}

export function resolveCoachResponse(
  mode: CoachMode,
  data: ExecutiveReportData,
  displayName?: string
): { text: string; mode: CoachMode } {
  const name = displayName?.trim() || "Anderson";

  switch (mode) {
    case "today":
      return { text: buildCoachTodayResponse(data, name), mode };
    case "now":
      return { text: buildCoachNowResponseFromReport(data, name), mode };
    case "executive-week":
      return { text: buildCoachExecutiveWeekResponse(data, name), mode };
    case "performance":
      return { text: buildCoachPerformanceResponse(data, name), mode };
    case "opportunity":
      return { text: buildCoachOpportunityResponse(data, name), mode };
    case "alerts":
      return { text: buildCoachAlertsResponse(data, name), mode };
    case "goals":
      return { text: buildCoachGoalsResponse(data, name), mode };
    case "goals-late":
      return { text: buildCoachGoalsLateResponse(data, name), mode };
    case "post-today":
      return { text: buildCoachPostTodayResponse(data, name), mode };
    case "xp-level":
      return { text: buildCoachXpLevelResponse(data, name), mode };
    case "xp-progress":
      return { text: buildCoachXpProgressResponse(data, name), mode };
    case "xp-missions":
      return { text: buildCoachXpMissionsResponse(data, name), mode };
    case "important-today":
      return { text: buildCoachImportantTodayResponse(data, name), mode };
    case "intro":
    default:
      return { text: buildCoachIntroResponse(name), mode: "intro" };
  }
}

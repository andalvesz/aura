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
  normalizeConteudoStatus,
} from "@/utils/social";

export type CoachMode =
  | "today"
  | "executive-week"
  | "performance"
  | "alerts"
  | "opportunity"
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

  if (actionId === "o-que-fazer" || matchesAny(normalized, TODAY_PHRASES)) {
    return "today";
  }
  if (matchesAny(normalized, WEEK_PHRASES)) return "executive-week";
  if (matchesAny(normalized, ROUTINE_PHRASES)) return "performance";
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

export function buildCoachIntroResponse(displayName = "Anderson"): string {
  return `${formatReportGreeting(displayName)}

Sou sua **Aura Coach** — mentor pessoal e executivo da Aura OS.

Posso analisar seus dados reais e orientar decisões. Experimente:

• **"O que devo fazer hoje?"** — compromissos, leads, tarefas, hábitos e conteúdos
• **"Como está minha semana?"** — receita, eventos, leads e metas
• **"Como está minha rotina?"** — hábitos, treinos, leituras e meditações
• **"Onde devo focar?"** — priorização automática por impacto
• **"Alertas"** — leads parados, metas atrasadas e riscos

Estou pronta quando você estiver.`;
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
    case "executive-week":
      return { text: buildCoachExecutiveWeekResponse(data, name), mode };
    case "performance":
      return { text: buildCoachPerformanceResponse(data, name), mode };
    case "opportunity":
      return { text: buildCoachOpportunityResponse(data, name), mode };
    case "alerts":
      return { text: buildCoachAlertsResponse(data, name), mode };
    case "intro":
    default:
      return { text: buildCoachIntroResponse(name), mode: "intro" };
  }
}

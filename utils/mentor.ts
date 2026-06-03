import type {
  Conteudo,
  Gasto,
  HealthHabit,
  HealthMeal,
  HealthSession,
  HealthWorkout,
} from "@/types/database";
import { computeFinanceStats, getCategoryLabel } from "@/utils/finance";
import { formatBRL, formatDate, formatTime, isToday } from "@/utils/format";
import {
  analyzeGrowthLeadContentInsights,
  buildExecutiveDayContext,
  buildExecutivePriorities,
  computeGrowthLeadMetrics,
  computeMonthlyExecutiveScore,
  detectExecutiveAlerts,
  getGrowthLeadStatusLabel,
  getTodayDate,
  mergeDailyMissions,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import { buildFollowUpMentorSection } from "@/utils/follow-up";
import {
  computeHealthMetrics,
  mealsForToday,
  todayIsoDate,
  workoutForToday,
} from "@/utils/health";
import {
  buildNexusAlveszContext,
  buildNexusAlveszUnavailableContext,
  buildNexusCalendarContext,
  buildNexusCalendarUnavailableContext,
  computeAlveszMetrics,
  filterUpcomingEventos,
  type NexusModuleData,
} from "@/utils/nexus";
import {
  computeSocialMetrics,
  getConteudoStatusLabel,
} from "@/utils/social";

export type AuraGlobalSummaryData = NexusModuleData & {
  conteudos: Conteudo[];
  gastos: Gasto[];
  healthHabits: HealthHabit[];
  healthWorkouts: HealthWorkout[];
  healthMeals: HealthMeal[];
  healthSessions: HealthSession[];
  socialAvailable: boolean;
  financeAvailable: boolean;
  healthAvailable: boolean;
};

export const AURA_MENTOR_GLOBAL_SUMMARY_ACTIONS = [
  "meu-dia",
  "calendario-hoje",
  "dashboard-executivo",
  "resumo-global",
  "prioridades-hoje",
] as const;

export type AuraMentorGlobalSummaryAction =
  (typeof AURA_MENTOR_GLOBAL_SUMMARY_ACTIONS)[number];

const GLOBAL_SUMMARY_PHRASES = [
  "o que fazer hoje",
  "resumo do dia",
  "minha agenda",
  "prioridades de hoje",
  "minhas prioridades",
  "meu dia",
  "central de comando",
  "o que tenho hoje",
  "como esta meu dia",
  "como está meu dia",
  "visao geral do dia",
  "visão geral do dia",
  "resumo global",
  "resumo da aura",
] as const;

function normalizeMentorQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isAuraMentorGlobalSummaryAction(
  actionId: string
): actionId is AuraMentorGlobalSummaryAction {
  return AURA_MENTOR_GLOBAL_SUMMARY_ACTIONS.includes(
    actionId as AuraMentorGlobalSummaryAction
  );
}

export function isAuraMentorGlobalSummaryQuery(
  message: string,
  actionId?: string
): boolean {
  if (actionId && isAuraMentorGlobalSummaryAction(actionId)) return true;

  const normalized = normalizeMentorQuery(message);
  if (!normalized) return false;

  if (
    GLOBAL_SUMMARY_PHRASES.some((phrase) =>
      normalized.includes(normalizeMentorQuery(phrase))
    )
  ) {
    return true;
  }

  if (/^(prioridades|minha agenda|resumo do dia)\??$/.test(normalized)) {
    return true;
  }

  if (normalized.includes("minha agenda")) return true;

  if (
    /^prioridades\b/.test(normalized) &&
    !normalized.includes("oportunidad") &&
    !normalized.includes("leads") &&
    !normalized.includes("crm")
  ) {
    return true;
  }

  return false;
}

function buildFinanceSection(gastos: Gasto[], available: boolean): string {
  if (!available && gastos.length === 0) {
    return `## FINANCEIRO
*Nenhum dado financeiro disponível (tabela gastos).*
`;
  }

  const stats = computeFinanceStats(gastos);
  const recentLines =
    stats.monthGastos.length > 0
      ? stats.monthGastos
          .slice(0, 6)
          .map(
            (g) =>
              `* ${g.titulo} — ${formatBRL(Number(g.valor))} (${getCategoryLabel(g.categoria)}) — ${g.data}`
          )
          .join("\n")
      : "* Nenhum gasto registrado no mês";

  return `## FINANCEIRO (dados reais — tabela gastos)

### Resumo do mês
* Total gasto: ${formatBRL(stats.totalMonth)}
* Previsão de despesas no mês: ${formatBRL(stats.forecast)}
* Maior categoria: ${stats.topCategory?.label ?? "N/A"} (${stats.topCategory?.pct ?? 0}%)
* Saldo: defina o saldo inicial no Financeiro; o saldo atual usa base + receitas − gastos do mês

### Gastos recentes
${recentLines}
`;
}

function buildSocialSection(conteudos: Conteudo[], available: boolean): string {
  if (!available && conteudos.length === 0) {
    return `## SOCIAL MEDIA
*Nenhum dado de conteúdo disponível (tabela conteudos).*
`;
  }

  const metrics = computeSocialMetrics(conteudos);
  const pending = metrics.normalized.filter((c) => c.status !== "publicado");
  const pendingLines =
    pending.length > 0
      ? pending
          .slice(0, 6)
          .map(
            (c) =>
              `* ${c.titulo} — ${c.plataforma} · ${getConteudoStatusLabel(c.status)}`
          )
          .join("\n")
      : "* Nenhum conteúdo pendente";

  return `## SOCIAL MEDIA (dados reais — tabela conteudos)

### Resumo
* Ideias: ${metrics.ideias}
* Em produção: ${metrics.emProducao}
* Publicados: ${metrics.publicados}
* Pendentes: ${pending.length}

### Conteúdos pendentes
${pendingLines}
`;
}

function buildHealthSection(data: AuraGlobalSummaryData): string {
  const hasData =
    data.healthHabits.length > 0 ||
    data.healthWorkouts.length > 0 ||
    data.healthMeals.length > 0 ||
    data.healthSessions.length > 0;

  if (!data.healthAvailable && !hasData) {
    return `## SAÚDE
*Nenhum dado de saúde disponível (tabelas health_*).*
`;
  }

  const hoje = todayIsoDate();
  const metrics = computeHealthMetrics(
    data.healthHabits,
    data.healthWorkouts,
    data.healthSessions
  );
  const habitsHoje = data.healthHabits.filter((h) => h.data === hoje);
  const mealsHoje = mealsForToday(data.healthMeals);
  const workoutHoje = workoutForToday(data.healthWorkouts);

  const habitLines =
    habitsHoje.length > 0
      ? habitsHoje
          .map((h) => `* ${h.titulo} — ${h.frequencia} · ${h.status}`)
          .join("\n")
      : "* Nenhum hábito registrado hoje";

  const mealLines =
    mealsHoje.length > 0
      ? mealsHoje
          .map((m) => `* ${m.nome} (${m.horario}) — ${m.alimentos}`)
          .join("\n")
      : "* Nenhuma refeição registrada hoje";

  const workoutLine = workoutHoje
    ? `* ${workoutHoje.nome} — ${workoutHoje.grupo_muscular} · ${workoutHoje.duracao_min} min`
    : "* Nenhum treino registrado hoje";

  return `## SAÚDE (dados reais — tabelas health_*)

### Resumo
* Hábitos hoje: ${metrics.habitsHoje}
* Hábitos ativos: ${metrics.habitsAtivos}
* Treinos na semana: ${metrics.treinosSemana}
* Leituras: ${metrics.leituras} · Meditações: ${metrics.meditacoes}

### Hábitos de hoje
${habitLines}

### Treino de hoje
${workoutLine}

### Refeições de hoje
${mealLines}
`;
}

function buildGrowthSection(data: AuraGlobalSummaryData): string {
  const leadMetrics = computeGrowthLeadMetrics(data.leads);
  const todayMissions = mergeDailyMissions(data.missions);
  const pendingMissions = todayMissions.filter((m) => m.status === "pending");
  const topLeads = sortGrowthLeadOpportunities(data.leads).slice(0, 5);
  const contentInsights = analyzeGrowthLeadContentInsights(data.leads);
  const priorities = buildExecutivePriorities(
    data.leads,
    data.missions,
    contentInsights,
    data.orcamentos
  );
  const followUpSection = buildFollowUpMentorSection(
    data.leads,
    data.orcamentos,
    data.clientes
  );
  const alerts = detectExecutiveAlerts(data.leads, data.missions, leadMetrics);
  const score = computeMonthlyExecutiveScore(data.missions, data.leads);
  const metaMensal = data.goal?.meta_receita_mensal ?? 0;
  const receitaAtual = data.goal?.receita_atual ?? 0;

  const leadLines =
    topLeads.length > 0
      ? topLeads
          .map(
            (l) =>
              `* ${l.nome} — ${getGrowthLeadStatusLabel(l.status)} — ${formatBRL(l.valor_potencial ?? 0)}`
          )
          .join("\n")
      : "* Nenhum lead ativo";

  const missionLines =
    todayMissions.length > 0
      ? todayMissions
          .map(
            (m) =>
              `* ${m.titulo}: ${m.status === "completed" ? "concluída" : "pendente"} (+${m.xp} XP)`
          )
          .join("\n")
      : "* Nenhuma missão hoje";

  const priorityLines =
    priorities.length > 0
      ? priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "1. Cadastrar leads e metas para personalizar prioridades.";

  const alertLines =
    alerts.length > 0 ? alerts.join("\n") : "Nenhum alerta crítico no momento.";

  return `## CRESCIMENTO (dados reais — growth_leads, growth_missions, growth_goals)

${followUpSection}

### Meta mensal
* Meta: ${formatBRL(metaMensal)}
* Receita atual: ${formatBRL(receitaAtual)}
* Faltam: ${formatBRL(Math.max(0, metaMensal - receitaAtual))}
* Receita potencial (CRM): ${formatBRL(leadMetrics.receitaPotencial)}
* Receita fechada (CRM): ${formatBRL(leadMetrics.receita)}
* Score do mês: ${score}/100

### Prioridades calculadas
${priorityLines}

### Alertas
${alertLines}

### Leads prioritários
${leadLines}

### Missões de hoje (${pendingMissions.length} pendentes)
${missionLines}
`;
}

function buildCalendarSummarySection(data: AuraGlobalSummaryData): string {
  if (!data.calendarAvailable && data.eventos.length === 0) {
    return buildNexusCalendarUnavailableContext();
  }

  const todayEvents = filterUpcomingEventos(data.eventos, 14).filter((e) =>
    isToday(e.data_inicio.slice(0, 10))
  );
  const upcoming = filterUpcomingEventos(data.eventos, 7).slice(0, 8);

  const todayLines =
    todayEvents.length > 0
      ? todayEvents
          .map(
            (e) =>
              `* ${formatTime(e.data_inicio)} — ${e.titulo}${e.local ? ` · ${e.local}` : ""}`
          )
          .join("\n")
      : "* Nenhum evento hoje";

  const upcomingLines =
    upcoming.length > 0
      ? upcoming
          .map((e) => {
            const day = isToday(e.data_inicio.slice(0, 10))
              ? "Hoje"
              : formatDate(e.data_inicio);
            return `* ${day} ${formatTime(e.data_inicio)} — ${e.titulo} (${e.tipo})`;
          })
          .join("\n")
      : "* Agenda vazia nos próximos 7 dias";

  return `## CALENDÁRIO — RESUMO (${getTodayDate()})

### Eventos de hoje
${todayLines}

### Próximos 7 dias
${upcomingLines}

${buildNexusCalendarContext(data)}
`;
}

function buildAlveszSummarySection(data: AuraGlobalSummaryData): string {
  if (!data.alveszAvailable && !data.clientes.length && !data.orcamentos.length) {
    return buildNexusAlveszUnavailableContext();
  }

  const metrics = computeAlveszMetrics(data.orcamentos);

  return `## ALVESZ — RESUMO
* Clientes: ${data.clientes.length}
* Orçamentos: ${data.orcamentos.length} (${metrics.pendentes} pendentes, ${metrics.aprovados} aprovados)
* Pipeline pendente: ${formatBRL(metrics.pipelinePendente)}
* Receita aprovada: ${formatBRL(metrics.receitaAprovada)}

${buildNexusAlveszContext(data)}
`;
}

export function buildAuraGlobalSummaryContext(data: AuraGlobalSummaryData): string {
  const executiveBase = buildExecutiveDayContext({
    leads: data.leads,
    goal: data.goal,
    missions: data.missions,
  });

  return `## RESUMO GLOBAL AURA OS — CONTEXTO CONSOLIDADO (${getTodayDate()})

Você é o assistente central da Aura OS. Gere UMA resposta única que integre todos os módulos abaixo.
Use apenas dados reais do usuário logado. Nunca invente valores, nomes ou compromissos.
Se um módulo estiver vazio, informe explicitamente e sugira o próximo passo prático.

Estruture a resposta consolidada assim:

1. **Prioridades do dia** — top 3 ações integrando comercial, agenda, conteúdo e saúde
2. **Agenda** — eventos de hoje e próximos compromissos
3. **Crescimento** — missões, leads e meta mensal
4. **Alvesz** — pipeline e oportunidades de eventos
5. **Social Media** — conteúdos pendentes e produção
6. **Saúde** — hábitos, treino e refeições do dia
7. **Financeiro** — gastos do mês e saldo
8. **Próximo passo imediato** — a ação mais importante agora

Seja direto, executivo e orientado a decisão. Tom de Diretor Executivo pessoal.

---

${executiveBase}

---

${buildGrowthSection(data)}

---

${buildCalendarSummarySection(data)}

---

${buildAlveszSummarySection(data)}

---

${buildSocialSection(data.conteudos, data.socialAvailable)}

---

${buildFinanceSection(data.gastos, data.financeAvailable)}

---

${buildHealthSection(data)}

---

## INSTRUÇÕES FINAIS
- Responda em português do Brasil
- Uma única resposta fluida — não separe por módulos com títulos repetidos desnecessariamente
- Cite nomes, valores, horários e status reais de cada módulo
- Se não houver dados em algum módulo, diga "sem dados cadastrados" e siga
- Termine com as 3 ações de maior impacto para hoje`;
}

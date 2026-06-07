import type {
  AlveszEvento,
  Conteudo,
  Evento,
  FinancialGoal,
  FinancialIncome,
  Gasto,
  Goal,
  GrowthLead,
  GrowthMission,
  HealthHabit,
  HealthMeal,
  HealthSession,
  HealthWorkout,
  Lead,
  Orcamento,
} from "@/types/database";
import { computeLeadFunnel } from "@/utils/consorcios";
import { filterUpcomingEventos } from "@/utils/nexus";
import { computeSmartFinanceStats, getIncomeOrigemLabel } from "@/utils/finance";
import { formatBRL } from "@/utils/format";
import {
  findMostDelayedGoal,
  getActiveGoals,
  GOAL_TIPO_LABELS,
  isGoalBehind,
} from "@/utils/goals";
import {
  analyzeGrowthLeadContentInsights,
  computeGrowthLeadMetrics,
  detectExecutiveAlerts,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import { computeHealthMetrics, todayIsoDate } from "@/utils/health";
import { computeSocialMetrics, normalizeConteudoStatus } from "@/utils/social";
import { getTopStaleOpportunity } from "@/utils/follow-up";

export type BiDomain =
  | "leads"
  | "eventos"
  | "conteudos"
  | "financas"
  | "metas"
  | "saude";

export type BiItemKind = "insight" | "oportunidade" | "alerta" | "recomendacao";

export type BiSeverity = "alta" | "media" | "baixa";

export type BiItem = {
  id: string;
  kind: BiItemKind;
  domain: BiDomain;
  severity: BiSeverity;
  title: string;
  description: string;
  href?: string;
  impactScore?: number;
};

export type BiDomainScore = {
  domain: BiDomain;
  label: string;
  score: number;
  href: string;
  reason: string;
};

export type BiQuestions = {
  ondeFocar: string;
  oportunidadePerdida: string;
  oQueGeraResultado: string;
};

export type BiSummary = {
  totalInsights: number;
  totalOportunidades: number;
  totalAlertas: number;
  totalRecomendacoes: number;
  hasData: boolean;
};

export type BiAnalysis = {
  items: BiItem[];
  domainScores: BiDomainScore[];
  questions: BiQuestions;
  summary: BiSummary;
  generatedAt: string;
};

export type BiInputData = {
  growthLeads: GrowthLead[];
  consorcioLeads: Lead[];
  eventos: Evento[];
  alveszEventos: AlveszEvento[];
  conteudos: Conteudo[];
  gastos: Gasto[];
  financialIncome: FinancialIncome[];
  financialGoals: FinancialGoal[];
  financialBalance: number | null;
  goals: Goal[];
  healthHabits: HealthHabit[];
  healthWorkouts: HealthWorkout[];
  healthMeals: HealthMeal[];
  healthSessions: HealthSession[];
  missions?: GrowthMission[];
  orcamentos?: Orcamento[];
};

const DOMAIN_LABELS: Record<BiDomain, string> = {
  leads: "Leads",
  eventos: "Eventos",
  conteudos: "Conteúdos",
  financas: "Finanças",
  metas: "Metas",
  saude: "Saúde",
};

const DOMAIN_HREFS: Record<BiDomain, string> = {
  leads: "/dashboard/crescimento",
  eventos: "/dashboard/calendario",
  conteudos: "/dashboard/social-media",
  financas: "/dashboard/financeiro",
  metas: "/dashboard/metas",
  saude: "/dashboard/saude",
};

let itemCounter = 0;

function nextId(prefix: string) {
  itemCounter += 1;
  return `bi-${prefix}-${itemCounter}`;
}

function resetItemCounter() {
  itemCounter = 0;
}

function severityWeight(severity: BiSeverity) {
  if (severity === "alta") return 3;
  if (severity === "media") return 2;
  return 1;
}

function pushItem(
  items: BiItem[],
  item: Omit<BiItem, "id"> & { id?: string }
) {
  items.push({ ...item, id: item.id ?? nextId(item.kind) });
}

export function hasBiData(data: BiInputData): boolean {
  return (
    data.growthLeads.length > 0 ||
    data.consorcioLeads.length > 0 ||
    data.eventos.length > 0 ||
    data.alveszEventos.length > 0 ||
    data.conteudos.length > 0 ||
    data.gastos.length > 0 ||
    data.financialIncome.length > 0 ||
    data.goals.length > 0 ||
    data.healthHabits.length > 0 ||
    data.healthWorkouts.length > 0
  );
}

function analyzeLeads(data: BiInputData, items: BiItem[]) {
  const { growthLeads, consorcioLeads, missions = [] } = data;
  const metrics = computeGrowthLeadMetrics(growthLeads);
  const opportunities = sortGrowthLeadOpportunities(growthLeads);
  const stale = getTopStaleOpportunity({
    leads: growthLeads,
    orcamentos: data.orcamentos ?? [],
  });

  if (growthLeads.length > 0) {
    pushItem(items, {
      kind: "insight",
      domain: "leads",
      severity: "media",
      title: "Pipeline de crescimento",
      description: `${metrics.ativos} leads ativos · ${formatBRL(metrics.receita)} fechados no mês · taxa de conversão ${metrics.taxaConversao}%`,
      href: DOMAIN_HREFS.leads,
      impactScore: metrics.receita,
    });
  }

  if (stale) {
    pushItem(items, {
      kind: "oportunidade",
      domain: "leads",
      severity: "alta",
      title: `Follow-up: ${stale.context.nome}`,
      description: `${formatBRL(stale.context.valor)} parado há ${stale.context.idleDays} dias (${stale.context.tipoEvento}).`,
      href: DOMAIN_HREFS.leads,
      impactScore: stale.context.valor,
    });
  }

  const topLead = opportunities[0];
  if (topLead && topLead.nome !== stale?.context.nome) {
    pushItem(items, {
      kind: "oportunidade",
      domain: "leads",
      severity: topLead.status === "negociacao" ? "alta" : "media",
      title: `Avançar ${topLead.nome}`,
      description: `${formatBRL(topLead.valor_potencial ?? 0)} em ${topLead.status.replace("_", " ")}.`,
      href: DOMAIN_HREFS.leads,
      impactScore: Number(topLead.valor_potencial ?? 0),
    });
  }

  const alerts = detectExecutiveAlerts(growthLeads, missions, metrics);
  for (const alert of alerts.slice(0, 3)) {
    pushItem(items, {
      kind: "alerta",
      domain: "leads",
      severity: "alta",
      title: "Alerta de leads",
      description: alert.replace(/^⚠\s*/, ""),
      href: DOMAIN_HREFS.leads,
    });
  }

  if (consorcioLeads.length > 0) {
    const funnel = computeLeadFunnel(consorcioLeads);
    const abertos = consorcioLeads.filter((l) => l.status !== "fechado").length;
    pushItem(items, {
      kind: "insight",
      domain: "leads",
      severity: "baixa",
      title: "Funil Consórcios",
      description: `${consorcioLeads.length} leads · ${abertos} em aberto · ${funnel.find((f) => f.status === "fechado")?.count ?? 0} fechados`,
      href: "/dashboard/consorcios",
    });

    const novos = consorcioLeads.filter((l) => l.status === "novo");
    if (novos.length >= 3) {
      pushItem(items, {
        kind: "recomendacao",
        domain: "leads",
        severity: "media",
        title: "Contatar leads novos de consórcios",
        description: `${novos.length} leads novos aguardando primeiro contato.`,
        href: "/dashboard/consorcios",
      });
    }
  }

  if (growthLeads.length === 0 && consorcioLeads.length === 0) {
    pushItem(items, {
      kind: "recomendacao",
      domain: "leads",
      severity: "media",
      title: "Cadastrar leads",
      description: "Sem leads cadastrados, o funil de vendas não pode ser analisado.",
      href: DOMAIN_HREFS.leads,
    });
  }
}

function analyzeEventos(data: BiInputData, items: BiItem[]) {
  const { eventos, alveszEventos } = data;
  const upcoming = filterUpcomingEventos(eventos, 7);
  const today = todayIsoDate();
  const eventosHoje = eventos.filter(
    (e) => e.data_inicio.slice(0, 10) === today
  );

  if (eventosHoje.length > 0) {
    pushItem(items, {
      kind: "insight",
      domain: "eventos",
      severity: "media",
      title: "Agenda de hoje",
      description: `${eventosHoje.length} evento(s) hoje · próximo: ${eventosHoje[0]?.titulo ?? "—"}`,
      href: DOMAIN_HREFS.eventos,
    });
  }

  if (upcoming.length > 0) {
    pushItem(items, {
      kind: "insight",
      domain: "eventos",
      severity: "baixa",
      title: "Próximos 7 dias",
      description: `${upcoming.length} evento(s) agendados na semana.`,
      href: DOMAIN_HREFS.eventos,
    });
  }

  const todayDate = todayIsoDate();
  const alveszProximos = alveszEventos.filter((e) => e.data_evento >= todayDate);
  if (alveszProximos.length > 0) {
    const valorTotal = alveszProximos.reduce(
      (s, e) => s + Number(e.valor_fechado ?? 0),
      0
    );
    pushItem(items, {
      kind: "oportunidade",
      domain: "eventos",
      severity: "alta",
      title: "Próximos eventos Alvesz",
      description: `${alveszProximos.length} evento(s) · ${formatBRL(valorTotal)} em valor fechado`,
      href: "/dashboard/alvesz",
      impactScore: valorTotal,
    });
  }

  if (eventos.length === 0 && alveszEventos.length === 0) {
    pushItem(items, {
      kind: "recomendacao",
      domain: "eventos",
      severity: "baixa",
      title: "Planejar agenda",
      description: "Nenhum evento cadastrado — organize a semana no calendário.",
      href: DOMAIN_HREFS.eventos,
    });
  }
}

function analyzeConteudos(data: BiInputData, items: BiItem[]) {
  const { conteudos, growthLeads } = data;
  const metrics = computeSocialMetrics(conteudos);
  const contentInsights = analyzeGrowthLeadContentInsights(growthLeads);

  if (conteudos.length > 0) {
    pushItem(items, {
      kind: "insight",
      domain: "conteudos",
      severity: "media",
      title: "Pipeline de conteúdo",
      description: `${metrics.publicados} publicados · ${metrics.emProducao} em produção · ${metrics.ideias} ideias`,
      href: DOMAIN_HREFS.conteudos,
      impactScore: metrics.publicados * 10,
    });
  }

  const pendentes = metrics.normalized.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );
  if (pendentes.length >= 5) {
    pushItem(items, {
      kind: "alerta",
      domain: "conteudos",
      severity: "media",
      title: "Backlog de conteúdo",
      description: `${pendentes.length} conteúdos ainda não publicados.`,
      href: DOMAIN_HREFS.conteudos,
    });
  }

  if (contentInsights.maiorDemanda) {
    pushItem(items, {
      kind: "recomendacao",
      domain: "conteudos",
      severity: "media",
      title: "Vertical com mais demanda",
      description: `Leads indicam foco em ${contentInsights.maiorDemanda} — alinhe o calendário editorial.`,
      href: DOMAIN_HREFS.conteudos,
    });
  }

  const publicadosMes = conteudos.filter((c) => {
    if (normalizeConteudoStatus(c.status) !== "publicado" || !c.data_publicacao) {
      return false;
    }
    const d = new Date(c.data_publicacao);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  });
  if (publicadosMes.length === 0 && conteudos.length > 0) {
    pushItem(items, {
      kind: "alerta",
      domain: "conteudos",
      severity: "alta",
      title: "Nenhuma publicação no mês",
      description: "Conteúdos planejados, mas nada publicado ainda neste mês.",
      href: DOMAIN_HREFS.conteudos,
    });
  }
}

function analyzeFinancas(data: BiInputData, items: BiItem[]) {
  const stats = computeSmartFinanceStats({
    gastos: data.gastos,
    income: data.financialIncome,
    goals: data.financialGoals,
    initialBalance: data.financialBalance,
  });

  if (data.gastos.length > 0 || data.financialIncome.length > 0) {
    pushItem(items, {
      kind: "insight",
      domain: "financas",
      severity: "media",
      title: "Resumo financeiro do mês",
      description: `Receitas ${formatBRL(stats.totalIncomeMonth)} · Gastos ${formatBRL(stats.totalMonth)}${stats.saldoAtual != null ? ` · Saldo ${formatBRL(stats.saldoAtual)}` : ""}`,
      href: DOMAIN_HREFS.financas,
      impactScore: stats.totalIncomeMonth,
    });
  }

  if (stats.expenseAlert.unusual) {
    pushItem(items, {
      kind: "alerta",
      domain: "financas",
      severity: "alta",
      title: "Gastos acima da média",
      description: `Gastos do mês (${formatBRL(stats.totalMonth)}) superam a média recente (${formatBRL(stats.expenseAlert.avgPrevious)}).`,
      href: DOMAIN_HREFS.financas,
    });
  }

  if (stats.activeGoal && stats.goalProgress && stats.goalProgress.pct < 50) {
    pushItem(items, {
      kind: "alerta",
      domain: "financas",
      severity: "media",
      title: `Meta financeira: ${stats.activeGoal.titulo}`,
      description: `Apenas ${stats.goalProgress.pct}% da meta (${formatBRL(stats.goalProgress.remaining)} restantes).`,
      href: DOMAIN_HREFS.financas,
    });
  }

  if (stats.topCategory && stats.topCategory.pct >= 35) {
    pushItem(items, {
      kind: "recomendacao",
      domain: "financas",
      severity: "baixa",
      title: `Maior gasto: ${stats.topCategory.label}`,
      description: `${stats.topCategory.pct}% dos gastos do mês (${formatBRL(stats.topCategory.total)}).`,
      href: DOMAIN_HREFS.financas,
    });
  }

  const incomeByOrigem = new Map<string, number>();
  for (const row of stats.monthIncome) {
    incomeByOrigem.set(
      row.origem,
      (incomeByOrigem.get(row.origem) ?? 0) + Number(row.valor)
    );
  }
  const topOrigem = [...incomeByOrigem.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topOrigem && topOrigem[1] > 0) {
    pushItem(items, {
      kind: "insight",
      domain: "financas",
      severity: "baixa",
      title: "Principal fonte de receita",
      description: `${getIncomeOrigemLabel(topOrigem[0])}: ${formatBRL(topOrigem[1])} no mês.`,
      href: DOMAIN_HREFS.financas,
      impactScore: topOrigem[1],
    });
  }
}

function analyzeMetas(data: BiInputData, items: BiItem[]) {
  const active = getActiveGoals(data.goals);
  const delayed = findMostDelayedGoal(data.goals);

  if (active.length > 0) {
    const behind = active.filter((g) => isGoalBehind(g));
    pushItem(items, {
      kind: "insight",
      domain: "metas",
      severity: behind.length > 0 ? "alta" : "baixa",
      title: "Metas ativas",
      description: `${active.length} meta(s) em andamento · ${behind.length} atrasada(s)`,
      href: DOMAIN_HREFS.metas,
    });
  }

  if (delayed) {
    pushItem(items, {
      kind: "alerta",
      domain: "metas",
      severity: "alta",
      title: `Meta atrasada: ${delayed.titulo}`,
      description: `${GOAL_TIPO_LABELS[delayed.tipo]} · progresso abaixo do esperado para o prazo.`,
      href: DOMAIN_HREFS.metas,
    });
  }

  for (const goal of active.filter((g) => isGoalBehind(g)).slice(0, 2)) {
    pushItem(items, {
      kind: "recomendacao",
      domain: "metas",
      severity: "media",
      title: `Recuperar meta: ${goal.titulo}`,
      description: `Tipo ${GOAL_TIPO_LABELS[goal.tipo]} — revise rotina e prioridades.`,
      href: DOMAIN_HREFS.metas,
    });
  }
}

function analyzeSaude(data: BiInputData, items: BiItem[]) {
  const metrics = computeHealthMetrics(
    data.healthHabits,
    data.healthWorkouts,
    data.healthSessions
  );

  if (
    data.healthHabits.length > 0 ||
    data.healthWorkouts.length > 0 ||
    data.healthSessions.length > 0
  ) {
    pushItem(items, {
      kind: "insight",
      domain: "saude",
      severity: "baixa",
      title: "Rotina de saúde",
      description: `${metrics.treinosSemana} treinos na semana · ${metrics.habitsAtivos} hábitos ativos · ${metrics.habitsHoje} hábitos hoje`,
      href: DOMAIN_HREFS.saude,
      impactScore: metrics.treinosSemana * 5,
    });
  }

  if (metrics.treinosSemana === 0 && data.healthWorkouts.length > 0) {
    pushItem(items, {
      kind: "alerta",
      domain: "saude",
      severity: "media",
      title: "Sem treinos esta semana",
      description: "Nenhum treino registrado nos últimos 7 dias.",
      href: DOMAIN_HREFS.saude,
    });
  }

  if (metrics.habitsHoje === 0 && metrics.habitsAtivos > 0) {
    pushItem(items, {
      kind: "recomendacao",
      domain: "saude",
      severity: "media",
      title: "Hábitos de hoje",
      description: "Há hábitos ativos, mas nenhum registrado para hoje.",
      href: DOMAIN_HREFS.saude,
    });
  }

  const saudeGoal = getActiveGoals(data.goals).find((g) => g.tipo === "saude");
  if (saudeGoal && isGoalBehind(saudeGoal)) {
    pushItem(items, {
      kind: "alerta",
      domain: "saude",
      severity: "alta",
      title: `Meta de saúde atrasada`,
      description: `${saudeGoal.titulo} — ${saudeGoal.atual}/${saudeGoal.meta}.`,
      href: DOMAIN_HREFS.metas,
    });
  }
}

function computeDomainScores(items: BiItem[]): BiDomainScore[] {
  const scores = new Map<BiDomain, { score: number; reason: string }>();

  for (const domain of Object.keys(DOMAIN_LABELS) as BiDomain[]) {
    scores.set(domain, { score: 0, reason: "Sem sinais relevantes" });
  }

  for (const item of items) {
    const current = scores.get(item.domain)!;
    const weight = severityWeight(item.severity);
    const kindBoost =
      item.kind === "alerta" ? 4 : item.kind === "oportunidade" ? 3 : 1;
    current.score += weight * kindBoost;
    if (item.severity === "alta" || item.kind === "oportunidade") {
      current.reason = item.title;
    }
  }

  return (Object.keys(DOMAIN_LABELS) as BiDomain[])
    .map((domain) => ({
      domain,
      label: DOMAIN_LABELS[domain],
      score: scores.get(domain)?.score ?? 0,
      href: DOMAIN_HREFS[domain],
      reason: scores.get(domain)?.reason ?? "Sem sinais relevantes",
    }))
    .sort((a, b) => b.score - a.score);
}

function buildResultDrivers(data: BiInputData): { label: string; value: number }[] {
  const drivers: { label: string; value: number }[] = [];

  const leadMetrics = computeGrowthLeadMetrics(data.growthLeads);
  if (leadMetrics.receita > 0) {
    drivers.push({ label: "Vendas (Crescimento)", value: leadMetrics.receita });
  }

  const financeStats = computeSmartFinanceStats({
    gastos: data.gastos,
    income: data.financialIncome,
    goals: data.financialGoals,
    initialBalance: data.financialBalance,
  });
  if (financeStats.totalIncomeMonth > 0) {
    drivers.push({ label: "Receitas registradas", value: financeStats.totalIncomeMonth });
  }

  const social = computeSocialMetrics(data.conteudos);
  if (social.publicados > 0) {
    drivers.push({ label: "Conteúdos publicados", value: social.publicados * 100 });
  }

  const alveszValor = data.alveszEventos.reduce(
    (s, e) => s + Number(e.valor_fechado ?? 0),
    0
  );
  if (alveszValor > 0) {
    drivers.push({ label: "Eventos Alvesz fechados", value: alveszValor });
  }

  const consorciosFechados = data.consorcioLeads.filter((l) => l.status === "fechado").length;
  if (consorciosFechados > 0) {
    drivers.push({ label: "Leads Consórcios fechados", value: consorciosFechados * 500 });
  }

  return drivers.sort((a, b) => b.value - a.value);
}

function buildQuestions(
  domainScores: BiDomainScore[],
  items: BiItem[],
  data: BiInputData
): BiQuestions {
  const topDomain = domainScores[0];
  const topOportunidade = items
    .filter((i) => i.kind === "oportunidade")
    .sort((a, b) => (b.impactScore ?? 0) - (a.impactScore ?? 0))[0];

  const drivers = buildResultDrivers(data);
  const topDriver = drivers[0];

  const ondeFocar =
    topDomain && topDomain.score > 0
      ? `Priorize ${topDomain.label.toLowerCase()}: ${topDomain.reason}.`
      : "Cadastre dados nos módulos para personalizar o foco.";

  const oportunidadePerdida = topOportunidade
    ? `${topOportunidade.title} — ${topOportunidade.description}`
    : items.find((i) => i.kind === "alerta")?.description ??
      "Nenhuma oportunidade crítica identificada no momento.";

  const oQueGeraResultado = topDriver
    ? `${topDriver.label} lidera em impacto estimado (${topDriver.value >= 100 ? formatBRL(topDriver.value) : `${Math.round(topDriver.value)} pts`}).`
    : "Publique conteúdo, avance leads e registre receitas para medir resultados.";

  return { ondeFocar, oportunidadePerdida, oQueGeraResultado };
}

export function computeBiAnalysis(data: BiInputData): BiAnalysis {
  resetItemCounter();
  const items: BiItem[] = [];

  analyzeLeads(data, items);
  analyzeEventos(data, items);
  analyzeConteudos(data, items);
  analyzeFinancas(data, items);
  analyzeMetas(data, items);
  analyzeSaude(data, items);

  const domainScores = computeDomainScores(items);
  const questions = buildQuestions(domainScores, items, data);

  const summary: BiSummary = {
    totalInsights: items.filter((i) => i.kind === "insight").length,
    totalOportunidades: items.filter((i) => i.kind === "oportunidade").length,
    totalAlertas: items.filter((i) => i.kind === "alerta").length,
    totalRecomendacoes: items.filter((i) => i.kind === "recomendacao").length,
    hasData: hasBiData(data),
  };

  return {
    items: items.sort((a, b) => {
      const kindOrder: Record<BiItemKind, number> = {
        alerta: 0,
        oportunidade: 1,
        recomendacao: 2,
        insight: 3,
      };
      const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
      if (kindDiff !== 0) return kindDiff;
      return severityWeight(b.severity) - severityWeight(a.severity);
    }),
    domainScores,
    questions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export function filterBiItemsByKind(items: BiItem[], kind: BiItemKind) {
  return items.filter((i) => i.kind === kind);
}

export function filterBiItemsByDomain(items: BiItem[], domain: BiDomain) {
  return items.filter((i) => i.domain === domain);
}

export const BI_KIND_LABELS: Record<BiItemKind, string> = {
  insight: "Insights",
  oportunidade: "Oportunidades",
  alerta: "Alertas",
  recomendacao: "Recomendações",
};

export const BI_DOMAIN_LABELS = DOMAIN_LABELS;

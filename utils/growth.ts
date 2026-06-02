import type {
  GrowthAction,
  GrowthGoal,
  GrowthLead,
  GrowthMission,
  GrowthVertical,
} from "@/types/database";
import { formatBRL } from "@/utils/format";

export type MissionTemplate = {
  key: string;
  titulo: string;
  descricao: string;
  xp: number;
};

export const DAILY_MISSION_TEMPLATES: MissionTemplate[] = [
  {
    key: "prospectar",
    titulo: "Prospectar clientes",
    descricao: "Entrar em contato com 3 leads ou potenciais clientes hoje.",
    xp: 25,
  },
  {
    key: "postar",
    titulo: "Postar conteúdo",
    descricao: "Publicar ou agendar pelo menos 1 conteúdo nas redes.",
    xp: 20,
  },
  {
    key: "followup",
    titulo: "Fazer follow-up",
    descricao: "Retomar conversas pendentes com leads ou clientes.",
    xp: 20,
  },
  {
    key: "oferta",
    titulo: "Criar oferta",
    descricao: "Refinar ou criar uma oferta clara para vender hoje.",
    xp: 30,
  },
  {
    key: "estudar",
    titulo: "Estudar vendas",
    descricao: "Dedicar 20 minutos a aprender sobre vendas ou marketing.",
    xp: 15,
  },
  {
    key: "analisar",
    titulo: "Analisar perfil",
    descricao: "Revisar métricas ou posicionamento de um perfil social.",
    xp: 15,
  },
];

export const GROWTH_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
] as const;

export const SALES_VERTICALS: {
  id: GrowthVertical;
  label: string;
  description: string;
}[] = [
  {
    id: "alvesz",
    label: "Alvesz Experience",
    description: "Eventos, experiências e orçamentos premium.",
  },
  {
    id: "consorcios",
    label: "Consórcios",
    description: "Captação, simulação e fechamento de consórcios.",
  },
  {
    id: "marca_pessoal",
    label: "Marca pessoal Anderson Alves",
    description: "Autoridade, conteúdo e posicionamento digital.",
  },
];

export const AURA_MENTOR_SUGGESTIONS = [
  {
    id: "plano-conteudo",
    label: "Criar plano de conteúdo",
    prompt: "Crie um plano de conteúdo semanal para minhas redes.",
  },
  {
    id: "estrategia-vendas",
    label: "Criar estratégia de vendas",
    prompt: "Monte uma estratégia de vendas online para meus produtos.",
  },
  {
    id: "missoes-semana",
    label: "Gerar missões da semana",
    prompt: "Gere missões diárias de crescimento para esta semana.",
  },
  {
    id: "analisar-perfil",
    label: "Analisar perfil",
    prompt: "Analise meu perfil com base nos dados cadastrados.",
  },
  {
    id: "criar-oferta",
    label: "Criar oferta",
    prompt: "Ajude-me a criar uma oferta irresistível para vender online.",
  },
] as const;

export const XP_PER_LEVEL = 100;

export function calculateLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function getCurrentMonthReference(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentGoal(goals: GrowthGoal[]): GrowthGoal | null {
  const ref = getCurrentMonthReference();
  return goals.find((g) => g.mes_referencia.startsWith(ref.slice(0, 7))) ?? null;
}

export type MergedMission = MissionTemplate & {
  status: "pending" | "completed";
  recordId?: string;
};

export function mergeDailyMissions(
  missions: GrowthMission[],
  date = getTodayDate()
): MergedMission[] {
  const todayMissions = missions.filter((m) => m.mission_date === date);

  return DAILY_MISSION_TEMPLATES.map((template) => {
    const record = todayMissions.find((m) => m.mission_key === template.key);
    return {
      ...template,
      status: record?.status === "completed" ? "completed" : "pending",
      recordId: record?.id,
    };
  });
}

export function countCompletedToday(missions: GrowthMission[]): number {
  const today = getTodayDate();
  return missions.filter(
    (m) => m.mission_date === today && m.status === "completed"
  ).length;
}

export const GROWTH_LEAD_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "contato", label: "Contato" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
] as const;

export type GrowthLeadStatusValue = (typeof GROWTH_LEAD_STATUSES)[number]["value"];

export const GROWTH_LEAD_ACTIVE_STATUSES = [
  "novo",
  "contato",
  "proposta",
  "negociacao",
] as const;

export const GROWTH_LEAD_CANAIS = [
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "indicacao", label: "Indicação" },
  { value: "outro", label: "Outro" },
] as const;

export type GrowthLeadMetrics = {
  total: number;
  ativos: number;
  fechados: number;
  perdidos: number;
  receita: number;
  receitaPotencial: number;
  receitaEmNegociacao: number;
  receitaProvavel: number;
  ticketMedio: number;
  taxaConversao: number;
  maiorOportunidade: GrowthLead | null;
  porStatus: { status: string; count: number; percent: number }[];
};

export type GrowthLeadPriority = "ALTA" | "MÉDIA" | "BAIXA";

export const GROWTH_LEAD_WIN_PROBABILITY: Record<GrowthLeadStatusValue, number> = {
  novo: 0.1,
  contato: 0.2,
  proposta: 0.4,
  negociacao: 0.7,
  fechado: 1,
  perdido: 0,
};

const GROWTH_LEAD_STATUS_WEIGHT: Record<GrowthLeadStatusValue, number> = {
  negociacao: 4,
  proposta: 3,
  contato: 2,
  novo: 1,
  fechado: 0,
  perdido: 0,
};

export const GROWTH_MENTOR_EMPTY_LEADS_MESSAGE =
  "Você ainda não possui leads cadastrados. Cadastre seus primeiros leads para que eu possa analisar o funil.";

export const GROWTH_MENTOR_LEAD_ACTIONS = [
  "analisar-leads",
  "priorizar-oportunidades",
  "diagnostico-funil",
  "previsao-receita",
] as const;

export type GrowthMentorLeadAction =
  (typeof GROWTH_MENTOR_LEAD_ACTIONS)[number];

export function isGrowthMentorLeadAction(
  actionId: string
): actionId is GrowthMentorLeadAction {
  return GROWTH_MENTOR_LEAD_ACTIONS.includes(actionId as GrowthMentorLeadAction);
}

const GROWTH_MENTOR_LEAD_PHRASES = [
  "analise meus leads atuais",
  "analisar leads",
  "priorizar oportunidades",
  "diagnostico do funil",
  "diagnóstico do funil",
  "previsao de receita",
  "previsão de receita",
] as const;

function normalizeMentorQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isGrowthMentorLeadQuery(message: string, actionId?: string): boolean {
  if (actionId && isGrowthMentorLeadAction(actionId)) return true;

  const normalized = normalizeMentorQuery(message);

  if (GROWTH_MENTOR_LEAD_PHRASES.some((phrase) => normalized.includes(normalizeMentorQuery(phrase)))) {
    return true;
  }

  const mentionsLeads = /\bleads?\b/.test(normalized);
  const leadIntent =
    /analis|pipeline|funil|oportunidad|prioriz|converter|qualific|crm|meus leads|previsao|previsão|receita/.test(
      normalized
    );

  return mentionsLeads && leadIntent;
}

export function getGrowthLeadStatusLabel(status: string): string {
  return GROWTH_LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getGrowthLeadPriority(status: GrowthLeadStatusValue): GrowthLeadPriority {
  if (status === "negociacao") return "ALTA";
  if (status === "proposta") return "MÉDIA";
  return "BAIXA";
}

export function sortGrowthLeadOpportunities(leads: GrowthLead[]): GrowthLead[] {
  return [...leads]
    .filter((lead) =>
      GROWTH_LEAD_ACTIVE_STATUSES.includes(
        lead.status as (typeof GROWTH_LEAD_ACTIVE_STATUSES)[number]
      )
    )
    .sort((a, b) => {
      const statusDiff =
        GROWTH_LEAD_STATUS_WEIGHT[b.status] - GROWTH_LEAD_STATUS_WEIGHT[a.status];
      if (statusDiff !== 0) return statusDiff;
      return (b.valor_potencial ?? 0) - (a.valor_potencial ?? 0);
    });
}

export function computeGrowthLeadMetrics(leads: GrowthLead[]): GrowthLeadMetrics {
  const activeLeads = leads.filter((l) =>
    GROWTH_LEAD_ACTIVE_STATUSES.includes(
      l.status as (typeof GROWTH_LEAD_ACTIVE_STATUSES)[number]
    )
  );
  const ativos = activeLeads.length;
  const fechados = leads.filter((l) => l.status === "fechado").length;
  const perdidos = leads.filter((l) => l.status === "perdido").length;
  const nonPerdidoLeads = leads.filter((l) => l.status !== "perdido");
  const receita = leads
    .filter((l) => l.status === "fechado")
    .reduce((sum, l) => sum + (l.valor_potencial ?? 0), 0);
  const receitaPotencial = nonPerdidoLeads.reduce(
    (sum, l) => sum + (l.valor_potencial ?? 0),
    0
  );
  const receitaEmNegociacao = leads
    .filter((l) => l.status === "negociacao")
    .reduce((sum, l) => sum + (l.valor_potencial ?? 0), 0);
  const receitaProvavel = nonPerdidoLeads.reduce(
    (sum, l) =>
      sum + (l.valor_potencial ?? 0) * GROWTH_LEAD_WIN_PROBABILITY[l.status],
    0
  );
  const ticketMedio = leads.length > 0 ? receitaPotencial / leads.length : 0;
  const taxaConversao = leads.length > 0 ? (fechados / leads.length) * 100 : 0;
  const maiorOportunidade =
    activeLeads.length > 0
      ? activeLeads.reduce((best, lead) =>
          (lead.valor_potencial ?? 0) > (best.valor_potencial ?? 0) ? lead : best
        )
      : null;
  const porStatus = GROWTH_LEAD_STATUSES.map((s) => ({
    status: s.label,
    count: leads.filter((l) => l.status === s.value).length,
    percent: leads.length > 0
      ? Math.round((leads.filter((l) => l.status === s.value).length / leads.length) * 100)
      : 0,
  })).filter((entry) => entry.count > 0);

  return {
    total: leads.length,
    ativos,
    fechados,
    perdidos,
    receita,
    receitaPotencial,
    receitaEmNegociacao,
    receitaProvavel,
    ticketMedio,
    taxaConversao,
    maiorOportunidade,
    porStatus,
  };
}

function buildPrioritizedOpportunitiesContext(leads: GrowthLead[]): string {
  const prioritized = sortGrowthLeadOpportunities(leads);

  if (prioritized.length === 0) {
    return "Nenhuma oportunidade ativa para priorizar.";
  }

  return prioritized
    .map((lead, index) => {
      const priority = getGrowthLeadPriority(lead.status);
      return `${index + 1}. ${lead.nome}
${formatBRL(lead.valor_potencial ?? 0)}
Status: ${getGrowthLeadStatusLabel(lead.status)}
Prioridade: ${priority}`;
    })
    .join("\n\n");
}

function buildFunnelDiagnosisContext(metrics: GrowthLeadMetrics): string {
  if (metrics.total === 0) return "Funil vazio.";

  const funnelLines = GROWTH_LEAD_STATUSES.map((s) => {
    const entry = metrics.porStatus.find((item) => item.status === s.label);
    if (!entry) return null;
    return `* ${entry.status}: ${entry.count} leads (${entry.percent}%)`;
  })
    .filter(Boolean)
    .join("\n");

  const sortedStages = [...metrics.porStatus].sort((a, b) => b.percent - a.percent);
  const topStage = sortedStages[0];
  const activeStages = sortedStages.filter(
    (s) => s.status !== "Fechado" && s.status !== "Perdido"
  );
  const bottleneckHint =
    activeStages.length >= 2
      ? `Possível gargalo: ${activeStages[0]?.status} concentra ${activeStages[0]?.percent}% dos leads ativos — poucos avançam para ${activeStages[1]?.status}.`
      : topStage
        ? `${topStage.percent}% dos leads estão em ${topStage.status}.`
        : "";

  return `Distribuição do funil:
${funnelLines}

${bottleneckHint}`;
}

function buildRevenueForecastContext(metrics: GrowthLeadMetrics): string {
  return `Previsão de receita:
* Receita potencial: ${formatBRL(metrics.receitaPotencial)} (soma de leads não perdidos)
* Receita provável: ${formatBRL(metrics.receitaProvavel)} (ponderada por probabilidade de fechamento)
* Receita fechada: ${formatBRL(metrics.receita)}

Probabilidades usadas:
* Negociação = 70%
* Proposta = 40%
* Contato = 20%
* Novo = 10%
* Fechado = 100%`;
}

export function buildGrowthLeadsMentorContext(
  leads: GrowthLead[],
  actionId?: string
): string {
  const metrics = computeGrowthLeadMetrics(leads);

  if (leads.length === 0) {
    return `## LEADS DO CRM (dados reais do Supabase)

Nenhum lead cadastrado.

Resumo:
* Total de leads: 0
* Leads ativos: 0
* Leads fechados: 0
* Leads perdidos: 0
* Receita potencial: ${formatBRL(0)}
* Receita em negociação: ${formatBRL(0)}
* Receita fechada: ${formatBRL(0)}
* Receita provável: ${formatBRL(0)}
* Ticket médio: ${formatBRL(0)}
* Taxa de conversão: 0%

Responda exatamente: "${GROWTH_MENTOR_EMPTY_LEADS_MESSAGE}"`;
  }

  const leadLines = leads
    .map(
      (lead) =>
        `* ${lead.nome} | ${getGrowthLeadStatusLabel(lead.status).toLowerCase()} | ${formatBRL(lead.valor_potencial ?? 0)}`
    )
    .join("\n");

  const statusLines =
    metrics.porStatus.length > 0
      ? metrics.porStatus
          .map((entry) => `* ${entry.status}: ${entry.count} (${entry.percent}%)`)
          .join("\n")
      : "* Nenhum";

  const maiorOportunidadeLine = metrics.maiorOportunidade
    ? `${metrics.maiorOportunidade.nome}, em ${getGrowthLeadStatusLabel(metrics.maiorOportunidade.status).toLowerCase()}, com valor potencial de ${formatBRL(metrics.maiorOportunidade.valor_potencial ?? 0)}`
    : "nenhuma oportunidade ativa";

  const baseContext = `## LEADS DO CRM (dados reais do Supabase — use exclusivamente estes dados)

Leads:
${leadLines}

Resumo do pipeline:
* Total de leads: ${metrics.total}
* Leads ativos: ${metrics.ativos}
* Leads fechados: ${metrics.fechados}
* Leads perdidos: ${metrics.perdidos}
* Receita potencial: ${formatBRL(metrics.receitaPotencial)}
* Receita em negociação: ${formatBRL(metrics.receitaEmNegociacao)}
* Receita fechada: ${formatBRL(metrics.receita)}
* Receita provável: ${formatBRL(metrics.receitaProvavel)}
* Ticket médio: ${formatBRL(metrics.ticketMedio)}
* Taxa de conversão: ${metrics.taxaConversao.toFixed(1)}%
* Maior oportunidade: ${maiorOportunidadeLine}
* Leads por status:
${statusLines}`;

  let actionContext = "";

  if (actionId === "priorizar-oportunidades") {
    actionContext = `

## PRIORIZAÇÃO DE OPORTUNIDADES (pré-calculada)
${buildPrioritizedOpportunitiesContext(leads)}

## INSTRUÇÕES PARA ESTA RESPOSTA
- Apresente a lista ordenada por valor e status, destacando oportunidades quentes (Negociação = ALTA, Proposta = MÉDIA).
- Use o formato numerado com nome, valor em R$, status e prioridade.
- Para cada lead, sugira uma ação concreta e imediata.
- Nunca peça leads manualmente — use apenas os dados acima.`;
  } else if (actionId === "diagnostico-funil") {
    actionContext = `

## DIAGNÓSTICO DO FUNIL (pré-calculado)
${buildFunnelDiagnosisContext(metrics)}

## INSTRUÇÕES PARA ESTA RESPOSTA
- Analise cada etapa: Novo, Contato, Proposta, Negociação, Fechado, Perdido.
- Identifique gargalos com percentuais reais (ex.: "60% dos leads estão em Proposta").
- Aponte onde poucos leads avançam e sugira a causa provável.
- Gere recomendações práticas para destravar o funil.
- Nunca peça leads manualmente — use apenas os dados acima.`;
  } else if (actionId === "previsao-receita") {
    actionContext = `

## PREVISÃO DE RECEITA (pré-calculada)
${buildRevenueForecastContext(metrics)}

## INSTRUÇÕES PARA ESTA RESPOSTA
- Exiba receita potencial, receita provável e receita fechada com valores reais.
- Explique brevemente como a receita provável foi estimada (probabilidades por status).
- Sugira ações para converter receita provável em fechada.
- Nunca peça leads manualmente — use apenas os dados acima.`;
  } else {
    actionContext = `

## REGRAS OBRIGATÓRIAS PARA ESTA RESPOSTA
- Use APENAS os leads listados acima — nunca peça ao usuário para informar leads manualmente.
- Cite nomes, status e valores reais.
- Se o usuário pedir análise, priorização, diagnóstico ou previsão, baseie-se somente nestes dados do CRM.`;
  }

  return `${baseContext}${actionContext}`;
}

export function computeRevenueProgress(goal: GrowthGoal | null): number {
  if (!goal || goal.meta_receita_mensal <= 0) return 0;
  return Math.min(
    100,
    Math.round((goal.receita_atual / goal.meta_receita_mensal) * 100)
  );
}

export function getActionForVertical(
  actions: GrowthAction[],
  vertical: GrowthVertical
): GrowthAction | undefined {
  return actions.find((a) => a.vertical === vertical);
}

export function isSalesActionConfigured(action: GrowthAction | undefined): boolean {
  if (!action) return false;
  return Boolean(
    action.oferta_principal ||
      action.canal_venda ||
      action.publico_alvo ||
      action.cta ||
      action.funil ||
      action.ideias_acao
  );
}

export function hasAnySalesAction(actions: GrowthAction[]): boolean {
  return SALES_VERTICALS.some((v) => isSalesActionConfigured(getActionForVertical(actions, v.id)));
}

export function getLatestAnalysisForProfile<
  T extends { profile_id: string | null; status: string; created_at: string }
>(analyses: T[], profileId: string): T | undefined {
  return analyses
    .filter((a) => a.profile_id === profileId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export const SALES_FUNNEL_STEPS = [
  "Atração",
  "Interesse",
  "Proposta",
  "Fechamento",
] as const;

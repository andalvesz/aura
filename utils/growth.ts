import type { ProfileAnalysisResult } from "@/lib/growth/types";
import type {
  GrowthAction,
  GrowthContentMemory,
  GrowthGoal,
  GrowthLead,
  GrowthMission,
  GrowthVertical,
  Orcamento,
} from "@/types/database";
import { formatBRL } from "@/utils/format";
import { parseProfileAnalysis } from "@/utils/instagram";
import {
  getFollowUpIdleTier,
  getFollowUpTierLabel,
  getTopStaleOpportunity,
} from "@/utils/follow-up";

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

export const GROWTH_MENTOR_CONTENT_ACTIONS = [
  "gerar-conteudo",
  "planejamento-semanal",
] as const;

export const GROWTH_MENTOR_EXECUTIVE_ACTIONS = ["meu-dia"] as const;

export const GROWTH_MENTOR_MEMORY_ACTIONS = ["insights-do-mes"] as const;

export const GROWTH_MENTOR_CRM_ACTIONS = [
  ...GROWTH_MENTOR_LEAD_ACTIONS,
  ...GROWTH_MENTOR_CONTENT_ACTIONS,
] as const;

export type GrowthMentorLeadAction =
  (typeof GROWTH_MENTOR_LEAD_ACTIONS)[number];

export type GrowthMentorContentAction =
  (typeof GROWTH_MENTOR_CONTENT_ACTIONS)[number];

export type GrowthMentorExecutiveAction =
  (typeof GROWTH_MENTOR_EXECUTIVE_ACTIONS)[number];

export type GrowthMentorMemoryAction =
  (typeof GROWTH_MENTOR_MEMORY_ACTIONS)[number];

export type GrowthMentorCrmAction = (typeof GROWTH_MENTOR_CRM_ACTIONS)[number];

export type GrowthContentInsights = {
  nichos: { label: string; count: number }[];
  maiorDemanda: string | null;
  ticketMedio: number;
  statusPredominante: string | null;
  oportunidadesAbertas: GrowthLead[];
  temLeadsConsorcio: boolean;
  leadsConsorcio: GrowthLead[];
};

export function isGrowthMentorLeadAction(
  actionId: string
): actionId is GrowthMentorLeadAction {
  return GROWTH_MENTOR_LEAD_ACTIONS.includes(actionId as GrowthMentorLeadAction);
}

export function isGrowthMentorContentAction(
  actionId: string
): actionId is GrowthMentorContentAction {
  return GROWTH_MENTOR_CONTENT_ACTIONS.includes(actionId as GrowthMentorContentAction);
}

export function isGrowthMentorExecutiveAction(
  actionId: string
): actionId is GrowthMentorExecutiveAction {
  return GROWTH_MENTOR_EXECUTIVE_ACTIONS.includes(actionId as GrowthMentorExecutiveAction);
}

export function isGrowthMentorMemoryAction(
  actionId: string
): actionId is GrowthMentorMemoryAction {
  return GROWTH_MENTOR_MEMORY_ACTIONS.includes(actionId as GrowthMentorMemoryAction);
}

export function isGrowthMentorCrmAction(
  actionId: string
): actionId is GrowthMentorCrmAction {
  return GROWTH_MENTOR_CRM_ACTIONS.includes(actionId as GrowthMentorCrmAction);
}

const CONTENT_NICHE_PATTERNS: { label: string; patterns: RegExp[] }[] = [
  { label: "Casamentos", patterns: [/casamento/i, /noiv[oa]/i, /wedding/i] },
  { label: "Aniversários", patterns: [/anivers[aá]rio/i, /15 anos/i, /debutante/i] },
  { label: "Corporativo", patterns: [/corporativ/i, /empresa/i, /confraterniza/i] },
  { label: "Formaturas", patterns: [/formatura/i, /cola[cç][aã]o/i] },
  {
    label: "Consórcios",
    patterns: [/cons[oó]rcio/i, /im[oó]vel/i, /ve[ií]culo/i, /ademicon/i, /investimento/i],
  },
  { label: "Festas", patterns: [/festa/i, /evento/i] },
];

const GROWTH_MENTOR_LEAD_PHRASES = [
  "analise meus leads atuais",
  "analisar leads",
  "priorizar oportunidades",
  "diagnostico do funil",
  "diagnóstico do funil",
  "previsao de receita",
  "previsão de receita",
] as const;

const GROWTH_MENTOR_CONTENT_PHRASES = [
  "gerar conteudo",
  "gerar conteúdo",
  "planejamento semanal",
  "plano de conteudo",
  "plano de conteúdo",
  "ideias de reels",
  "ideias de posts",
] as const;

const GROWTH_MENTOR_EXECUTIVE_PHRASES = [
  "meu dia",
  "resumo do dia",
  "prioridades de hoje",
  "central de comando",
] as const;

const GROWTH_MENTOR_MEMORY_PHRASES = [
  "insights do mes",
  "insights do mês",
  "padroes de sucesso",
  "padrões de sucesso",
  "memoria estrategica",
  "memória estratégica",
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

export function isGrowthMentorContentQuery(message: string, actionId?: string): boolean {
  if (actionId && isGrowthMentorContentAction(actionId)) return true;

  const normalized = normalizeMentorQuery(message);

  return GROWTH_MENTOR_CONTENT_PHRASES.some((phrase) =>
    normalized.includes(normalizeMentorQuery(phrase))
  );
}

export function isGrowthMentorExecutiveQuery(message: string, actionId?: string): boolean {
  if (actionId && isGrowthMentorExecutiveAction(actionId)) return true;

  const normalized = normalizeMentorQuery(message);

  return GROWTH_MENTOR_EXECUTIVE_PHRASES.some((phrase) =>
    normalized.includes(normalizeMentorQuery(phrase))
  );
}

export function isGrowthMentorMemoryQuery(message: string, actionId?: string): boolean {
  if (actionId && isGrowthMentorMemoryAction(actionId)) return true;

  const normalized = normalizeMentorQuery(message);

  return GROWTH_MENTOR_MEMORY_PHRASES.some((phrase) =>
    normalized.includes(normalizeMentorQuery(phrase))
  );
}

export function isGrowthMentorCrmQuery(message: string, actionId?: string): boolean {
  return (
    isGrowthMentorLeadQuery(message, actionId) ||
    isGrowthMentorContentQuery(message, actionId)
  );
}

function inferLeadContentNiche(lead: GrowthLead): string {
  if (lead.vertical === "consorcios") return "Consórcios";

  const text = `${lead.nome} ${lead.origem} ${lead.observacoes ?? ""}`;
  for (const { label, patterns } of CONTENT_NICHE_PATTERNS) {
    if (label === "Consórcios") continue;
    if (patterns.some((pattern) => pattern.test(text))) return label;
  }

  if (lead.vertical === "alvesz") return "Eventos";
  if (lead.vertical === "marca_pessoal") return "Marca pessoal";
  return "Outros";
}

export function analyzeGrowthLeadContentInsights(
  leads: GrowthLead[]
): GrowthContentInsights {
  const metrics = computeGrowthLeadMetrics(leads);
  const nicheCounts = new Map<string, number>();

  for (const lead of leads) {
    const niche = inferLeadContentNiche(lead);
    nicheCounts.set(niche, (nicheCounts.get(niche) ?? 0) + 1);
  }

  const nichos = [...nicheCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const statusPredominante =
    metrics.porStatus.length > 0
      ? [...metrics.porStatus].sort((a, b) => b.count - a.count)[0]?.status ?? null
      : null;

  const leadsConsorcio = leads.filter(
    (lead) => lead.vertical === "consorcios" || inferLeadContentNiche(lead) === "Consórcios"
  );

  return {
    nichos,
    maiorDemanda: nichos[0]?.label ?? null,
    ticketMedio: metrics.ticketMedio,
    statusPredominante,
    oportunidadesAbertas: sortGrowthLeadOpportunities(leads),
    temLeadsConsorcio: leadsConsorcio.length > 0,
    leadsConsorcio,
  };
}

function buildContentInsightsContext(insights: GrowthContentInsights): string {
  const nicheLines =
    insights.nichos.length > 0
      ? insights.nichos.map((n) => `${n.count} ${n.label.toLowerCase()}`).join("\n")
      : "Nenhum nicho identificado nos leads";

  const oportunidadesLines =
    insights.oportunidadesAbertas.length > 0
      ? insights.oportunidadesAbertas
          .slice(0, 5)
          .map(
            (lead) =>
              `* ${lead.nome} — ${getGrowthLeadStatusLabel(lead.status)} — ${formatBRL(lead.valor_potencial ?? 0)}`
          )
          .join("\n")
      : "* Nenhuma oportunidade aberta";

  return `## INSIGHTS DE CONTEÚDO (derivados do CRM)

Nichos mais frequentes:
${nicheLines}

Conclusão:
Maior demanda atual: ${insights.maiorDemanda ?? "Sem dados suficientes"}

Métricas:
* Ticket médio: ${formatBRL(insights.ticketMedio)}
* Status predominante: ${insights.statusPredominante ?? "N/A"}

Oportunidades abertas:
${oportunidadesLines}

Leads de consórcio: ${insights.temLeadsConsorcio ? `${insights.leadsConsorcio.length} lead(s)` : "Nenhum"}`;
}

function buildContentPlanInstructions(insights: GrowthContentInsights): string {
  const demandFocus = insights.maiorDemanda ?? "Eventos premium (Alvesz Experience)";

  let instructions = `## PLANO DE CONTEÚDO AUTOMÁTICO

Gere com base na maior demanda (${demandFocus}):

1. **5 ideias de Reels** — títulos/ganchos prontos para gravar
2. **5 ideias de Stories** — sequências ou enquetes
3. **5 ideias de Posts** — carrossel ou feed estático
4. **CTAs para captação** — convites claros para WhatsApp/DM

Exemplos de formato esperado:
Reel: "Quanto custa um bartender para casamento?"
Story: "Bastidores da montagem do bar"
Post: "5 erros ao contratar um bartender"

Priorize o nicho "${demandFocus}" e adapte tom para Indaiatuba/SP.
Instagram principal: @and.alvesz · Alvesz Experience · bartender premium.`;

  if (insights.temLeadsConsorcio) {
    instructions += `

## CONTEÚDO PARA CONSÓRCIOS (Ademicon)

Existem ${insights.leadsConsorcio.length} lead(s) de consórcio no CRM. Gere também:
- 3 ideias de vídeos educativos
- 3 posts educativos (imóvel, veículo, investimento)
- 3 perguntas frequentes com respostas curtas
- CTA de captação para consórcio Ademicon`;
  }

  return instructions;
}

function buildWeeklyPlanningInstructions(insights: GrowthContentInsights): string {
  const demandFocus = insights.maiorDemanda ?? "Eventos e marca pessoal";

  return `## PLANEJAMENTO SEMANAL DE CONTEÚDO

Monte o calendário completo (Segunda a Domingo) com conteúdos sugeridos para cada dia.

Use a demanda atual do CRM (${demandFocus}) para priorizar temas.

Formato obrigatório:
**Segunda** — [tipo: Reel/Story/Post] + tema + CTA
**Terça** — ...
**Quarta** — ...
**Quinta** — ...
**Sexta** — ...
**Sábado** — ...
**Domingo** — ...

Inclua mix de: vendas, bastidores, educativo e prova social.
Alinhe Alvesz Experience + @and.alvesz${insights.temLeadsConsorcio ? " + Consórcios Ademicon" : ""}.`;
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
  const isContentAction =
    actionId === "gerar-conteudo" || actionId === "planejamento-semanal";
  const metrics = computeGrowthLeadMetrics(leads);
  const contentInsights = analyzeGrowthLeadContentInsights(leads);

  if (leads.length === 0) {
    if (isContentAction) {
      return `## LEADS DO CRM (dados reais do Supabase)

Nenhum lead cadastrado ainda.

${buildContentInsightsContext(contentInsights)}

## CONTEXTO DE MARCA
- Anderson Alves · Indaiatuba, SP
- Alvesz Experience · bartender premium · casamentos · eventos
- Consórcios Ademicon
- Instagram principal: @and.alvesz

${actionId === "planejamento-semanal" ? buildWeeklyPlanningInstructions(contentInsights) : buildContentPlanInstructions(contentInsights)}

Gere conteúdo genérico de alta conversão para Alvesz Experience e @and.alvesz, mencionando que ainda não há leads no CRM para personalizar por nicho.`;
    }

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
  } else if (actionId === "gerar-conteudo") {
    actionContext = `

${buildContentInsightsContext(contentInsights)}

${buildContentPlanInstructions(contentInsights)}

## INSTRUÇÕES PARA ESTA RESPOSTA
- Baseie 100% das ideias na maior demanda identificada no CRM.
- Entregue exatamente: 5 reels, 5 stories, 5 posts e CTAs de captação.
- Use tom premium, local (Indaiatuba) e orientado a vendas.
- Nunca peça dados manualmente — use os insights acima.`;
  } else if (actionId === "planejamento-semanal") {
    actionContext = `

${buildContentInsightsContext(contentInsights)}

${buildWeeklyPlanningInstructions(contentInsights)}

## INSTRUÇÕES PARA ESTA RESPOSTA
- Organize Segunda a Domingo com tipo de conteúdo, tema e CTA por dia.
- Priorize o nicho de maior demanda do CRM.
- Combine vendas, bastidores, educativo e prova social.
- Nunca peça dados manualmente — use os insights acima.`;
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

export function parseGrowthAnalysisContent(
  conteudo: string | null
): ProfileAnalysisResult | null {
  if (!conteudo) return null;
  try {
    const parsed = JSON.parse(conteudo) as { result?: Record<string, unknown> };
    return parseProfileAnalysis(parsed.result ?? null);
  } catch {
    return null;
  }
}

export const SALES_FUNNEL_STEPS = [
  "Atração",
  "Interesse",
  "Proposta",
  "Fechamento",
] as const;

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthPrefix(date = getCurrentMonthReference()): string {
  return date.slice(0, 7);
}

export function computeMonthlyExecutiveScore(
  missions: GrowthMission[],
  leads: GrowthLead[],
  monthPrefix = getMonthPrefix()
): number {
  const missionsCompleted = missions.filter(
    (m) => m.mission_date.startsWith(monthPrefix) && m.status === "completed"
  ).length;
  const leadsCreated = leads.filter((l) => l.created_at.startsWith(monthPrefix)).length;
  const salesClosed = leads.filter(
    (l) => l.status === "fechado" && l.updated_at.startsWith(monthPrefix)
  ).length;
  const contentPublished = missions.filter(
    (m) =>
      m.mission_key === "postar" &&
      m.status === "completed" &&
      m.mission_date.startsWith(monthPrefix)
  ).length;

  const missionPts = Math.min(25, Math.round((missionsCompleted / 30) * 25));
  const leadPts = Math.min(25, Math.round((leadsCreated / 8) * 25));
  const salesPts = Math.min(25, Math.round((salesClosed / 4) * 25));
  const contentPts = Math.min(25, Math.round((contentPublished / 12) * 25));

  return missionPts + leadPts + salesPts + contentPts;
}

export function detectExecutiveAlerts(
  leads: GrowthLead[],
  missions: GrowthMission[],
  metrics: GrowthLeadMetrics
): string[] {
  const alerts: string[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  for (const lead of leads) {
    if (!GROWTH_LEAD_ACTIVE_STATUSES.includes(
      lead.status as (typeof GROWTH_LEAD_ACTIVE_STATUSES)[number]
    )) {
      continue;
    }

    const idleDays = daysSince(lead.updated_at);
    const tier = getFollowUpIdleTier(idleDays);

    if (tier) {
      alerts.push(
        `⚠ ${lead.nome} — ${getFollowUpTierLabel(tier)} (${formatBRL(lead.valor_potencial ?? 0)}).`
      );
    }
  }

  const recentLeads = leads.filter((l) => new Date(l.created_at) >= sevenDaysAgo);
  if (leads.length > 0 && recentLeads.length === 0) {
    alerts.push("⚠ Nenhum lead novo nos últimos 7 dias.");
  }

  const activeStages = metrics.porStatus.filter(
    (s) => s.status !== "Fechado" && s.status !== "Perdido" && s.count > 0
  );
  const topActive = activeStages.sort((a, b) => b.percent - a.percent)[0];
  if (topActive && topActive.percent >= 50 && metrics.ativos >= 3) {
    alerts.push(
      `⚠ Funil travado: ${topActive.percent}% dos leads ativos estão em ${topActive.status}.`
    );
  }

  const recentContent = missions.some(
    (m) =>
      m.mission_key === "postar" &&
      m.status === "completed" &&
      new Date(m.mission_date) >= sevenDaysAgo
  );
  if (!recentContent) {
    alerts.push("⚠ Queda de conteúdo: nenhuma publicação registrada nos últimos 7 dias.");
  }

  return [...new Set(alerts)];
}

export function buildExecutivePriorities(
  leads: GrowthLead[],
  missions: GrowthMission[],
  contentInsights: GrowthContentInsights,
  orcamentos: Orcamento[] = []
): string[] {
  const priorities: string[] = [];
  const today = getTodayDate();
  const dailyMissions = mergeDailyMissions(missions, today);
  const staleTop = getTopStaleOpportunity({ leads, orcamentos });

  if (staleTop) {
    const ctx = staleTop.context;
    priorities.push(
      `Fazer follow-up com ${ctx.nome} (${formatBRL(ctx.valor)} · ${ctx.tipoEvento})`
    );
  }

  const topLead = sortGrowthLeadOpportunities(leads)[0];

  if (topLead && topLead.nome !== staleTop?.context.nome) {
    const valor = formatBRL(topLead.valor_potencial ?? 0);
    const status = getGrowthLeadStatusLabel(topLead.status).toLowerCase();
    if (topLead.status === "negociacao" || topLead.status === "proposta") {
      priorities.push(
        `Fazer follow-up com ${topLead.nome} (${valor} em ${status})`
      );
    } else {
      priorities.push(`Avançar ${topLead.nome} (${valor} — ${status})`);
    }
  }

  const postarMission = dailyMissions.find((m) => m.key === "postar");
  if (postarMission?.status === "pending") {
    const nicho = contentInsights.maiorDemanda ?? "eventos";
    priorities.push(`Publicar Reel sobre ${nicho.toLowerCase()}`);
  }

  const pendingMission = dailyMissions.find((m) => m.status === "pending");
  if (pendingMission) {
    priorities.push(`Concluir missão ${pendingMission.titulo}`);
  }

  const propostaLead = leads.find((l) => l.status === "proposta");
  if (propostaLead && propostaLead.nome !== topLead?.nome) {
    priorities.push(`Enviar proposta para ${propostaLead.nome}`);
  }

  const followupLead = leads.find(
    (l) => l.status === "contato" || l.status === "novo"
  );
  if (followupLead && priorities.length < 4) {
    priorities.push(`Prospectar ou contatar ${followupLead.nome}`);
  }

  return priorities.slice(0, 6);
}

export function buildExecutiveDayContext(params: {
  leads: GrowthLead[];
  goal: GrowthGoal | null;
  missions: GrowthMission[];
}): string {
  const { leads, goal, missions } = params;
  const metrics = computeGrowthLeadMetrics(leads);
  const contentInsights = analyzeGrowthLeadContentInsights(leads);
  const score = computeMonthlyExecutiveScore(missions, leads);
  const alerts = detectExecutiveAlerts(leads, missions, metrics);
  const prioridades = buildExecutivePriorities(leads, missions, contentInsights);
  const todayMissions = mergeDailyMissions(missions);

  const metaMensal = goal?.meta_receita_mensal ?? 0;
  const receitaFechada = metrics.receita;
  const faltaMeta = Math.max(0, metaMensal - receitaFechada);

  const prioridadesLines =
    prioridades.length > 0
      ? prioridades.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "1. Cadastrar leads e definir meta mensal para personalizar prioridades.";

  const alertLines =
    alerts.length > 0 ? alerts.join("\n") : "Nenhum alerta crítico no momento.";

  const missoesHoje = todayMissions
    .map((m) => `* ${m.titulo}: ${m.status === "completed" ? "concluída" : "pendente"}`)
    .join("\n");

  const topRecommendations = prioridades.slice(0, 3);

  return `## CENTRAL DE COMANDO — RESUMO EXECUTIVO (${getTodayDate()})

### Meta mensal
Meta: ${formatBRL(metaMensal)}
Fechado: ${formatBRL(receitaFechada)}
Faltam: ${formatBRL(faltaMeta)}

### Score do mês
Score atual: ${score}/100
(composição: missões concluídas · leads criados · vendas fechadas · conteúdo publicado)

### Alertas inteligentes
${alertLines}

### Prioridades de hoje (pré-calculadas)
${prioridadesLines}

### Missões de hoje
${missoesHoje}

### Pipeline resumido
* Leads ativos: ${metrics.ativos}
* Receita em negociação: ${formatBRL(metrics.receitaEmNegociacao)}
* Maior demanda (conteúdo): ${contentInsights.maiorDemanda ?? "N/A"}
* Taxa de conversão: ${metrics.taxaConversao.toFixed(1)}%

### Top 3 ações de maior impacto (pré-calculadas)
${topRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## INSTRUÇÕES PARA ESTA RESPOSTA
Responda como Diretor Executivo da Aura. Estruture assim:

1. **Prioridades de hoje** — use a lista pré-calculada, cite valores reais dos leads
2. **Meta mensal** — Meta / Fechado / Faltam com valores acima
3. **Alertas inteligentes** — liste os alertas detectados
4. **Score do mês** — Score atual: ${score}/100
5. **Se eu fosse você hoje, faria isso:** — liste exatamente as 3 ações de maior impacto

Seja direto, executivo e orientado a decisão. Use dados reais — nunca peça informações manualmente.`;
}

export type ClosedLeadInsight = {
  niche: string;
  count: number;
  avgValue: number;
  avgDaysToClose: number;
  topOrigin: string | null;
};

export type NichePerformance = {
  niche: string;
  total: number;
  closed: number;
  active: number;
  lost: number;
  conversionRate: number;
  avgTicket: number;
};

export type ContentMemoryInsight = {
  actionId: string;
  nicho: string | null;
  resumo: string | null;
  createdAt: string;
  leadsGerados: number;
  conversoes: number;
};

function daysBetween(start: string, end: string): number {
  return Math.max(
    0,
    Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))
  );
}

function countOrigins(leads: GrowthLead[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const origin = lead.origem?.trim() || lead.canal || "outro";
    counts.set(origin, (counts.get(origin) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function analyzeClosedLeads(leads: GrowthLead[]): ClosedLeadInsight[] {
  const closed = leads.filter((lead) => lead.status === "fechado");
  const byNiche = new Map<string, GrowthLead[]>();

  for (const lead of closed) {
    const niche = inferLeadContentNiche(lead);
    const group = byNiche.get(niche) ?? [];
    group.push(lead);
    byNiche.set(niche, group);
  }

  return [...byNiche.entries()]
    .map(([niche, nicheLeads]) => {
      const origins = countOrigins(nicheLeads);
      return {
        niche,
        count: nicheLeads.length,
        avgValue:
          nicheLeads.reduce((sum, lead) => sum + (lead.valor_potencial ?? 0), 0) /
          nicheLeads.length,
        avgDaysToClose:
          nicheLeads.reduce(
            (sum, lead) => sum + daysBetween(lead.created_at, lead.updated_at),
            0
          ) / nicheLeads.length,
        topOrigin: origins[0]?.label ?? null,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function analyzeNichePerformance(leads: GrowthLead[]): NichePerformance[] {
  const byNiche = new Map<string, GrowthLead[]>();

  for (const lead of leads) {
    const niche = inferLeadContentNiche(lead);
    const group = byNiche.get(niche) ?? [];
    group.push(lead);
    byNiche.set(niche, group);
  }

  return [...byNiche.entries()]
    .map(([niche, nicheLeads]) => {
      const closed = nicheLeads.filter((lead) => lead.status === "fechado");
      const active = nicheLeads.filter((lead) =>
        GROWTH_LEAD_ACTIVE_STATUSES.includes(
          lead.status as (typeof GROWTH_LEAD_ACTIVE_STATUSES)[number]
        )
      );
      const lost = nicheLeads.filter((lead) => lead.status === "perdido");

      return {
        niche,
        total: nicheLeads.length,
        closed: closed.length,
        active: active.length,
        lost: lost.length,
        conversionRate:
          nicheLeads.length > 0 ? (closed.length / nicheLeads.length) * 100 : 0,
        avgTicket:
          closed.length > 0
            ? closed.reduce((sum, lead) => sum + (lead.valor_potencial ?? 0), 0) /
              closed.length
            : 0,
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate || b.closed - a.closed);
}

export function analyzeContentMemoryImpact(
  memory: GrowthContentMemory[],
  leads: GrowthLead[]
): ContentMemoryInsight[] {
  return memory.map((entry) => {
    const entryDate = new Date(entry.created_at);
    const niche = entry.nicho;

    const leadsAfter = leads.filter((lead) => {
      if (new Date(lead.created_at) < entryDate) return false;
      if (!niche) return true;
      return inferLeadContentNiche(lead) === niche;
    });

    return {
      actionId: entry.action_id,
      nicho: entry.nicho,
      resumo: entry.resumo,
      createdAt: entry.created_at,
      leadsGerados: leadsAfter.length,
      conversoes: leadsAfter.filter((lead) => lead.status === "fechado").length,
    };
  });
}

export function detectStrategicAlerts(
  closedInsights: ClosedLeadInsight[],
  nichePerformance: NichePerformance[]
): string[] {
  const alerts: string[] = [];
  const totalClosed = closedInsights.reduce((sum, item) => sum + item.count, 0);

  if (totalClosed > 0 && closedInsights[0]) {
    const top = closedInsights[0];
    const share = Math.round((top.count / totalClosed) * 100);
    if (share >= 50) {
      alerts.push(
        `${share}% dos fechamentos vieram de ${top.niche} (ticket médio ${formatBRL(top.avgValue)}).`
      );
    }

    const highTicket = closedInsights.filter((item) => item.avgValue >= 10000);
    if (highTicket.length > 0) {
      const ticketShare = Math.round(
        (highTicket.reduce((sum, item) => sum + item.count, 0) / totalClosed) * 100
      );
      if (ticketShare >= 50) {
        alerts.push(
          `${ticketShare}% dos fechamentos têm ticket acima de R$ 10.000 — priorize oportunidades premium.`
        );
      }
    }
  }

  const sortedByConversion = [...nichePerformance].filter((item) => item.total >= 2);
  if (sortedByConversion.length >= 2) {
    const best = sortedByConversion[0];
    const mostActive = [...nichePerformance].sort((a, b) => b.active - a.active)[0];

    if (
      best &&
      mostActive &&
      best.niche !== mostActive.niche &&
      mostActive.active > best.active &&
      best.conversionRate >= mostActive.conversionRate * 2
    ) {
      const multiplier = Math.round(best.conversionRate / Math.max(mostActive.conversionRate, 1));
      alerts.push(
        `Você está investindo muito em ${mostActive.niche.toLowerCase()}, mas ${best.niche.toLowerCase()} convertem ${multiplier}x mais.`
      );
    }
  }

  return alerts;
}

export function buildStrategicMemoryContext(params: {
  leads: GrowthLead[];
  contentMemory: GrowthContentMemory[];
  missions: GrowthMission[];
}): string {
  const { leads, contentMemory, missions } = params;
  const monthPrefix = getMonthPrefix();
  const monthLeads = leads.filter((lead) => lead.created_at.startsWith(monthPrefix));
  const closedInsights = analyzeClosedLeads(leads);
  const monthClosedInsights = analyzeClosedLeads(
    leads.filter(
      (lead) =>
        lead.status === "fechado" && lead.updated_at.startsWith(monthPrefix)
    )
  );
  const nichePerformance = analyzeNichePerformance(leads);
  const contentImpact = analyzeContentMemoryImpact(contentMemory, leads);
  const alerts = detectStrategicAlerts(closedInsights, nichePerformance);
  const metrics = computeGrowthLeadMetrics(leads);
  const topOpportunity = sortGrowthLeadOpportunities(leads)[0];

  const topNiche =
    monthClosedInsights[0]?.niche ?? closedInsights[0]?.niche ?? "Sem dados";
  const winningTicket =
    monthClosedInsights[0]?.avgValue ?? closedInsights[0]?.avgValue ?? 0;
  const avgCloseDays =
    monthClosedInsights.length > 0
      ? monthClosedInsights.reduce((sum, item) => sum + item.avgDaysToClose, 0) /
        monthClosedInsights.length
      : closedInsights.length > 0
        ? closedInsights.reduce((sum, item) => sum + item.avgDaysToClose, 0) /
          closedInsights.length
        : 0;

  const closedHistoryLines =
    closedInsights.length > 0
      ? closedInsights
          .map(
            (item) =>
              `* ${item.niche}: ${item.count} fechamento(s) · ticket médio ${formatBRL(item.avgValue)} · ${Math.round(item.avgDaysToClose)} dias para fechar · origem principal: ${item.topOrigin ?? "N/A"}`
          )
          .join("\n")
      : "* Nenhum fechamento registrado ainda";

  const patternLines =
    nichePerformance.length > 0
      ? nichePerformance
          .map(
            (item) =>
              `* ${item.niche}: ${item.conversionRate.toFixed(0)}% conversão (${item.closed}/${item.total}) · ticket fechado ${formatBRL(item.avgTicket)} · ${item.active} ativo(s)`
          )
          .join("\n")
      : "* Dados insuficientes para padrões";

  const contentLines =
    contentImpact.length > 0
      ? contentImpact
          .slice(0, 8)
          .map(
            (item) =>
              `* ${item.actionId} (${item.nicho ?? "geral"}) em ${item.createdAt.slice(0, 10)} → ${item.leadsGerados} lead(s) · ${item.conversoes} conversão(ões)`
          )
          .join("\n")
      : "* Nenhum conteúdo registrado ainda — use Gerar Conteúdo ou Planejamento semanal";

  const postarCount = missions.filter(
    (m) =>
      m.mission_key === "postar" &&
      m.status === "completed" &&
      m.mission_date.startsWith(monthPrefix)
  ).length;

  const recommendation =
    closedInsights[0]?.niche ?? analyzeGrowthLeadContentInsights(leads).maiorDemanda;

  return `## MEMÓRIA ESTRATÉGICA — INSIGHTS DO MÊS (${monthPrefix})

### Histórico de fechamentos
${closedHistoryLines}

### Padrões de sucesso
${patternLines}

Leads criados no mês: ${monthLeads.length}
Conteúdos publicados (missões): ${postarCount}

### Aprendizado de conteúdo
${contentLines}

### Alertas estratégicos
${alerts.length > 0 ? alerts.map((a) => `⚠ ${a}`).join("\n") : "Nenhum alerta crítico — continue coletando dados."}

### Resumo pré-calculado
Top nicho: ${topNiche}
Ticket médio vencedor: ${formatBRL(winningTicket)}
Tempo médio para fechar: ${Math.round(avgCloseDays)} dias
Maior oportunidade: ${topOpportunity ? `${topOpportunity.nome} (${formatBRL(topOpportunity.valor_potencial ?? 0)} — ${getGrowthLeadStatusLabel(topOpportunity.status)})` : "Nenhuma ativa"}
Recomendação: ${recommendation ? `Aumentar produção de conteúdo para ${recommendation.toLowerCase()}.` : "Cadastre leads e registre fechamentos para gerar insights."}

Receita fechada total: ${formatBRL(metrics.receita)}

## INSTRUÇÕES PARA ESTA RESPOSTA
Responda como analista estratégico da Aura. Use exatamente estes blocos:

1. **Top nicho** — ${topNiche}
2. **Ticket médio vencedor** — ${formatBRL(winningTicket)}
3. **Tempo médio para fechar** — ${Math.round(avgCloseDays)} dias
4. **Maior oportunidade** — cite nome, valor e status reais
5. **Padrões de sucesso** — percentuais e tickets dos fechamentos
6. **Alertas** — destaque desalinhamentos (ex.: investimento vs conversão)
7. **Recomendação** — ação clara baseada nos padrões detectados

Use apenas dados reais do CRM e memória de conteúdo — nunca peça informações manualmente.`;
}

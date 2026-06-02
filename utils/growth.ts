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
  maiorOportunidade: GrowthLead | null;
  porStatus: { status: string; count: number }[];
};

export const GROWTH_MENTOR_EMPTY_LEADS_MESSAGE =
  "Você ainda não possui leads cadastrados. Cadastre seus primeiros leads para que eu possa analisar o funil.";

export const GROWTH_MENTOR_LEAD_ACTIONS = [
  "analisar-leads",
  "priorizar-oportunidades",
  "diagnostico-funil",
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
    /analis|pipeline|funil|oportunidad|prioriz|converter|qualific|crm|meus leads/.test(
      normalized
    );

  return mentionsLeads && leadIntent;
}

export function getGrowthLeadStatusLabel(status: string): string {
  return GROWTH_LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
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
  const receita = leads
    .filter((l) => l.status === "fechado")
    .reduce((sum, l) => sum + (l.valor_potencial ?? 0), 0);
  const receitaPotencial = activeLeads.reduce(
    (sum, l) => sum + (l.valor_potencial ?? 0),
    0
  );
  const maiorOportunidade =
    activeLeads.length > 0
      ? activeLeads.reduce((best, lead) =>
          (lead.valor_potencial ?? 0) > (best.valor_potencial ?? 0) ? lead : best
        )
      : null;
  const porStatus = GROWTH_LEAD_STATUSES.map((s) => ({
    status: s.label,
    count: leads.filter((l) => l.status === s.value).length,
  })).filter((entry) => entry.count > 0);

  return {
    total: leads.length,
    ativos,
    fechados,
    perdidos,
    receita,
    receitaPotencial,
    maiorOportunidade,
    porStatus,
  };
}

export function buildGrowthLeadsMentorContext(leads: GrowthLead[]): string {
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
* Receita fechada: ${formatBRL(0)}
* Maior oportunidade: nenhuma
* Leads por status: nenhum

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
      ? metrics.porStatus.map((entry) => `* ${entry.status}: ${entry.count}`).join("\n")
      : "* Nenhum";

  const maiorOportunidadeLine = metrics.maiorOportunidade
    ? `${metrics.maiorOportunidade.nome}, em ${getGrowthLeadStatusLabel(metrics.maiorOportunidade.status).toLowerCase()}, com valor potencial de ${formatBRL(metrics.maiorOportunidade.valor_potencial ?? 0)}`
    : "nenhuma oportunidade ativa";

  return `## LEADS DO CRM (dados reais do Supabase — use exclusivamente estes dados)

Leads:
${leadLines}

Resumo:
* Total de leads: ${metrics.total}
* Leads ativos: ${metrics.ativos}
* Leads fechados: ${metrics.fechados}
* Leads perdidos: ${metrics.perdidos}
* Receita potencial: ${formatBRL(metrics.receitaPotencial)}
* Receita fechada: ${formatBRL(metrics.receita)}
* Maior oportunidade: ${maiorOportunidadeLine}
* Leads por status:
${statusLines}

## REGRAS OBRIGATÓRIAS PARA ESTA RESPOSTA
- Use APENAS os leads listados acima — nunca peça ao usuário para informar leads manualmente.
- Cite nomes, status e valores reais (ex.: "Você possui ${metrics.ativos} leads ativos, com receita potencial de ${formatBRL(metrics.receitaPotencial)}. A maior oportunidade é ${maiorOportunidadeLine}.").
- Se o usuário pedir análise, priorização ou diagnóstico do funil, baseie-se somente nestes dados do CRM.`;
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

import type {
  GrowthAction,
  GrowthGoal,
  GrowthLead,
  GrowthMission,
  GrowthVertical,
} from "@/types/database";

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

export const GROWTH_LEAD_ACTIVE_STATUSES = ["novo", "contato", "proposta"] as const;

export type GrowthLeadMetrics = {
  total: number;
  ativos: number;
  fechados: number;
  receita: number;
};

export function computeGrowthLeadMetrics(leads: GrowthLead[]): GrowthLeadMetrics {
  const ativos = leads.filter((l) =>
    GROWTH_LEAD_ACTIVE_STATUSES.includes(
      l.status as (typeof GROWTH_LEAD_ACTIVE_STATUSES)[number]
    )
  ).length;
  const fechados = leads.filter((l) => l.status === "fechado").length;
  const receita = leads
    .filter((l) => l.status === "fechado")
    .reduce((sum, l) => sum + (l.valor_potencial ?? 0), 0);

  return {
    total: leads.length,
    ativos,
    fechados,
    receita,
  };
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

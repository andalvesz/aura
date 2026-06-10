import type {
  AutopilotAction,
  AutopilotControlLevel,
  AutopilotMonitor,
  AutopilotSettings,
  CreatorAdsCampaign,
  Json,
} from "@/types/database";

export type AutopilotRuleKey =
  | "pause_low_ctr"
  | "pause_high_cpa"
  | "alert_fast_budget"
  | "suggest_scale_roas"
  | "suggest_new_creative";

export type AutopilotRuleConfig = {
  enabled: boolean;
  threshold: number;
};

export type AutopilotRules = Record<AutopilotRuleKey, AutopilotRuleConfig>;

export type CampaignMetrics = {
  ctr: number;
  cpa: number;
  roas: number;
  frequency: number;
  budget_spent_pct: number;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  updated_at: string;
};

export type AutopilotDashboardMetrics = {
  totalCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  draftCampaigns: number;
  pendingActions: number;
  suggestedActions: number;
  rulesTriggeredToday: number;
  controlLevel: AutopilotControlLevel;
};

export type ManualActionType =
  | "start_campaign"
  | "pause_campaign"
  | "resume_campaign"
  | "duplicate_campaign"
  | "generate_creative"
  | "generate_copy";

export const AUTOPILOT_CONTROL_LEVELS: {
  id: AutopilotControlLevel;
  label: string;
  description: string;
}[] = [
  {
    id: "manual",
    label: "Manual",
    description: "Somente botões manuais. Regras não executam nada.",
  },
  {
    id: "suggest",
    label: "Sugestão",
    description: "Aura detecta problemas e sugere ações via notificação.",
  },
  {
    id: "prepare",
    label: "Preparar",
    description: "Aura prepara ações para você aprovar antes de executar.",
  },
  {
    id: "execute_approved",
    label: "Executar regras aprovadas",
    description: "Pausas automáticas seguras quando a regra estiver ativa.",
  },
];

export const AUTOPILOT_RULE_LABELS: Record<AutopilotRuleKey, string> = {
  pause_low_ctr: "Pausar se CTR baixo",
  pause_high_cpa: "Pausar se CPA alto",
  alert_fast_budget: "Alertar se orçamento gastar rápido",
  suggest_scale_roas: "Sugerir escala se ROAS bom",
  suggest_new_creative: "Sugerir novo criativo se frequência alta",
};

export const AUTOPILOT_IA_ACTIONS = [
  {
    id: "analisar-campanhas",
    label: "Analisar campanhas",
    prompt: "Analise minhas campanhas monitoradas e diga o que precisa de atenção.",
  },
  {
    id: "corrigir-problema",
    label: "Corrigir com IA",
    prompt: "Com base nas métricas atuais, sugira correções práticas para melhorar performance.",
  },
  {
    id: "priorizar-acoes",
    label: "Priorizar ações",
    prompt: "Quais ações pendentes devo aprovar primeiro e por quê?",
  },
];

export const AUTOPILOT_AI_CONTEXT = `Você é a Aura Autopilot — automação controlada de campanhas de tráfego pago.
Monitore métricas, tome decisões seguras e peça aprovação para ações sensíveis.
Nunca aumente orçamento nem publique campanha nova sem aprovação explícita.
Pausas automáticas só ocorrem com regra ativada e nível "execute_approved".
Responda em português do Brasil, de forma executiva e prática.`;

export const DEFAULT_AUTOPILOT_RULES: AutopilotRules = {
  pause_low_ctr: { enabled: false, threshold: 1.0 },
  pause_high_cpa: { enabled: false, threshold: 150 },
  alert_fast_budget: { enabled: true, threshold: 70 },
  suggest_scale_roas: { enabled: true, threshold: 3.0 },
  suggest_new_creative: { enabled: true, threshold: 3.5 },
};

export function parseAutopilotRules(raw: Json | null | undefined): AutopilotRules {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_AUTOPILOT_RULES;
  }
  const obj = raw as Record<string, unknown>;
  const result = { ...DEFAULT_AUTOPILOT_RULES };
  for (const key of Object.keys(DEFAULT_AUTOPILOT_RULES) as AutopilotRuleKey[]) {
    const entry = obj[key];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const rule = entry as Record<string, unknown>;
      result[key] = {
        enabled: Boolean(rule.enabled ?? result[key].enabled),
        threshold: Number(rule.threshold ?? result[key].threshold),
      };
    }
  }
  return result;
}

export function parseCampaignMetrics(raw: Json | null | undefined): CampaignMetrics | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.ctr !== "number") return null;
  return {
    ctr: Number(m.ctr),
    cpa: Number(m.cpa ?? 0),
    roas: Number(m.roas ?? 0),
    frequency: Number(m.frequency ?? 0),
    budget_spent_pct: Number(m.budget_spent_pct ?? 0),
    impressions: Number(m.impressions ?? 0),
    clicks: Number(m.clicks ?? 0),
    spend: Number(m.spend ?? 0),
    conversions: Number(m.conversions ?? 0),
    updated_at: String(m.updated_at ?? new Date().toISOString()),
  };
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function createInitialMetrics(campaignId: string): CampaignMetrics {
  const seed = hashSeed(campaignId);
  const ctr = 1.2 + (seed % 180) / 100;
  const cpa = 80 + (seed % 120);
  const roas = 1.5 + (seed % 250) / 100;
  return {
    ctr: Math.round(ctr * 100) / 100,
    cpa,
    roas: Math.round(roas * 100) / 100,
    frequency: 1.5 + (seed % 30) / 10,
    budget_spent_pct: 10 + (seed % 40),
    impressions: 5000 + (seed % 15000),
    clicks: Math.round((5000 + (seed % 15000)) * (ctr / 100)),
    spend: 200 + (seed % 800),
    conversions: 5 + (seed % 25),
    updated_at: new Date().toISOString(),
  };
}

export function evolveMetrics(
  campaignId: string,
  previous: CampaignMetrics | null
): CampaignMetrics {
  const base = previous ?? createInitialMetrics(campaignId);
  const seed = hashSeed(`${campaignId}-${Date.now()}`);
  const drift = (seed % 21 - 10) / 100;
  const ctr = Math.max(0.3, Math.min(5, base.ctr + drift));
  const cpa = Math.max(30, base.cpa + (seed % 41 - 20));
  const roas = Math.max(0.5, base.roas + drift * 0.5);
  const frequency = Math.max(1, base.frequency + (seed % 11 - 5) / 10);
  const budget_spent_pct = Math.min(100, Math.max(0, base.budget_spent_pct + (seed % 15)));
  const impressions = base.impressions + seed % 2000;
  const clicks = Math.round(impressions * (ctr / 100));
  const spend = base.spend + (seed % 100);
  const conversions = Math.max(0, base.conversions + (seed % 5 - 2));

  return {
    ctr: Math.round(ctr * 100) / 100,
    cpa,
    roas: Math.round(roas * 100) / 100,
    frequency: Math.round(frequency * 10) / 10,
    budget_spent_pct,
    impressions,
    clicks,
    spend,
    conversions,
    updated_at: new Date().toISOString(),
  };
}

export function computeAutopilotDashboard(params: {
  campaigns: CreatorAdsCampaign[];
  monitors: AutopilotMonitor[];
  actions: AutopilotAction[];
  settings: AutopilotSettings | null;
}): AutopilotDashboardMetrics {
  const { campaigns, monitors, actions, settings } = params;
  const monitorByCampaign = new Map(monitors.map((m) => [m.campaign_id, m]));
  let activeCampaigns = 0;
  let pausedCampaigns = 0;
  let draftCampaigns = 0;

  for (const c of campaigns) {
    const monitor = monitorByCampaign.get(c.id);
    if (c.status === "draft" && !monitor) {
      draftCampaigns++;
    } else if (monitor?.monitor_status === "paused" || c.status === "paused") {
      pausedCampaigns++;
    } else if (c.status === "active" || monitor?.monitor_status === "active") {
      activeCampaigns++;
    } else {
      draftCampaigns++;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const rulesTriggeredToday = actions.filter(
    (a) => a.trigger_type === "rule" && a.created_at.slice(0, 10) === today
  ).length;

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns,
    pausedCampaigns,
    draftCampaigns,
    pendingActions: actions.filter((a) => a.status === "pending_approval").length,
    suggestedActions: actions.filter((a) => a.status === "suggested").length,
    rulesTriggeredToday,
    controlLevel: settings?.control_level ?? "manual",
  };
}

export function intakeFromCampaign(campaign: CreatorAdsCampaign) {
  return {
    nome: campaign.nome ?? campaign.campanha_nome ?? "",
    avatar: campaign.avatar ?? "",
    problema: campaign.problema ?? "",
    solucao: campaign.solucao ?? "",
    promessa: campaign.promessa ?? "",
    diferencial: campaign.diferencial ?? "",
    preco: campaign.preco,
    product_id: campaign.product_id,
    copylab_id: campaign.copylab_id,
    asset_id: campaign.asset_id,
    landing_id: campaign.landing_id,
  };
}

export function buildAutopilotAuraContext(params: {
  dashboard: AutopilotDashboardMetrics;
  campaigns: CreatorAdsCampaign[];
  monitors: AutopilotMonitor[];
  actions: AutopilotAction[];
  settings: AutopilotSettings | null;
}): string {
  const { dashboard, campaigns, monitors, actions, settings } = params;
  const monitorMap = new Map(monitors.map((m) => [m.campaign_id, m]));
  const lines = [
    `Campanhas: ${dashboard.totalCampaigns} (${dashboard.activeCampaigns} ativas, ${dashboard.pausedCampaigns} pausadas)`,
    `Ações pendentes: ${dashboard.pendingActions} · Sugestões: ${dashboard.suggestedActions}`,
    `Nível de controle: ${settings?.control_level ?? "manual"}`,
  ];

  for (const c of campaigns.slice(0, 5)) {
    const monitor = monitorMap.get(c.id);
    const metrics = parseCampaignMetrics(monitor?.metrics ?? null);
    lines.push(
      `- ${c.nome ?? c.campanha_nome ?? "Campanha"} [${c.status}]: ${
        metrics
          ? `CTR ${metrics.ctr}% · CPA R$${metrics.cpa} · ROAS ${metrics.roas}x · Freq ${metrics.frequency}`
          : "sem métricas"
      }`
    );
  }

  const pending = actions.filter((a) =>
    ["pending_approval", "suggested"].includes(a.status)
  );
  if (pending.length > 0) {
    lines.push("Ações pendentes:");
    for (const a of pending.slice(0, 5)) {
      lines.push(`  · ${a.action_type}: ${a.reason ?? a.suggestion ?? "—"}`);
    }
  }

  return lines.join("\n");
}

export function getActionTypeLabel(actionType: string): string {
  const labels: Record<string, string> = {
    start_campaign: "Iniciar campanha",
    pause_campaign: "Pausar campanha",
    resume_campaign: "Retomar campanha",
    duplicate_campaign: "Duplicar campanha",
    generate_creative: "Gerar novo criativo",
    generate_copy: "Gerar nova copy",
    suggest_scale: "Sugerir escala",
    alert_budget: "Alerta de orçamento",
    alert_ctr: "Alerta de CTR",
    alert_cpa: "Alerta de CPA",
    alert_frequency: "Alerta de frequência",
    increase_budget: "Aumentar orçamento",
    publish_campaign: "Publicar campanha",
  };
  return labels[actionType] ?? actionType;
}

export function actionRequiresApproval(actionType: string): boolean {
  return ["increase_budget", "publish_campaign", "suggest_scale"].includes(actionType);
}

export function isSafeAutoAction(actionType: string): boolean {
  return actionType === "pause_campaign";
}

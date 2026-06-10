import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import { AutopilotActionsRepository } from "@/lib/supabase/repositories/autopilot-actions.repository";
import { AutopilotLogsRepository } from "@/lib/supabase/repositories/autopilot-logs.repository";
import { AutopilotMonitorsRepository } from "@/lib/supabase/repositories/autopilot-monitors.repository";
import { AutopilotSettingsRepository } from "@/lib/supabase/repositories/autopilot-settings.repository";
import { CreatorAdsCampaignsRepository } from "@/lib/supabase/repositories/creator-ads.repository";
import { NotificationsRepository } from "@/lib/supabase/repositories/notifications.repository";
import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import { generateStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { buildAuraContext } from "@/lib/supabase/services/aura-brain.service";
import { getPerformanceDashboard } from "@/lib/supabase/services/performance.service";
import { awardAuraXp } from "@/lib/supabase/services/xp.service";
import type {
  AutopilotAction,
  AutopilotControlLevel,
  AutopilotLog,
  AutopilotLogEventType,
  AutopilotMonitor,
  AutopilotSettings,
  CreatorAdsCampaign,
  Json,
  NotificationType,
  TableInsert,
} from "@/types/database";
import {
  actionRequiresApproval,
  buildAutopilotAuraContext,
  computeAutopilotDashboard,
  createInitialMetrics,
  DEFAULT_AUTOPILOT_RULES,
  evolveMetrics,
  intakeFromCampaign,
  isCtrLowForHours,
  isSafeAutoAction,
  parseAutopilotRules,
  parseCampaignMetrics,
  trackCtrLowSince,
  type AutopilotDashboardMetrics,
  type AutopilotRuleKey,
  type AutopilotRules,
  type CampaignMetrics,
  type ManualActionType,
} from "@/utils/autopilot";
import { getOptionalDataContext } from "./context";
import { loadAdsCampaigns } from "./ads-manager.service";
import { todayIsoDate } from "@/utils/health";

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function logAutopilot(
  ctx: NonNullable<Awaited<ReturnType<typeof getOptionalDataContext>>>,
  params: {
    eventType: AutopilotLogEventType;
    mensagem: string;
    detalhes?: Record<string, unknown>;
    campaignId?: string | null;
    actionId?: string | null;
    tipo?: "info" | "success" | "warning";
  }
) {
  recordSystemLog({
    tipo: params.tipo ?? "info",
    modulo: "autopilot",
    mensagem: params.mensagem,
    detalhes: params.detalhes ?? {},
  });

  const logsRepo = new AutopilotLogsRepository(ctx.supabase, ctx.userId);
  await logsRepo.append({
    event_type: params.eventType,
    message: params.mensagem,
    campaign_id: params.campaignId ?? null,
    action_id: params.actionId ?? null,
    details: (params.detalhes ?? {}) as Json,
  });
}

async function createAutopilotNotification(params: {
  repo: NotificationsRepository;
  type: NotificationType;
  title: string;
  message: string;
  actionId: string;
  campaignId?: string | null;
}) {
  await params.repo.create({
    title: params.title,
    message: params.message,
    type: params.type,
    status: "unread",
    related_module: "autopilot",
    related_id: params.actionId,
    scheduled_for: null,
  });
}

async function ensureSettings(
  settingsRepo: AutopilotSettingsRepository
): Promise<AutopilotSettings> {
  const { data } = await settingsRepo.findForUser();
  if (data) return data;

  const { data: created, error } = await settingsRepo.upsert({
    control_level: "manual",
    rules: DEFAULT_AUTOPILOT_RULES as unknown as Json,
  });
  if (error || !created) {
    return {
      user_id: "",
      control_level: "manual",
      rules: DEFAULT_AUTOPILOT_RULES as unknown as Json,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return created;
}

async function executeCampaignMutation(
  adsRepo: CreatorAdsCampaignsRepository,
  monitorsRepo: AutopilotMonitorsRepository,
  campaign: CreatorAdsCampaign,
  status: "active" | "paused" | "draft"
) {
  await adsRepo.update(campaign.id, { status });
  const { data: monitor } = await monitorsRepo.findByCampaignId(campaign.id);
  if (monitor) {
    await monitorsRepo.update(monitor.id, {
      monitor_status: status === "active" ? "active" : "paused",
    });
  }
}

async function executeActionBody(
  ctx: NonNullable<Awaited<ReturnType<typeof getOptionalDataContext>>>,
  action: AutopilotAction,
  campaign: CreatorAdsCampaign | null
): Promise<{ error: string | null; result?: Record<string, unknown> }> {
  const adsRepo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const monitorsRepo = new AutopilotMonitorsRepository(ctx.supabase, ctx.userId);

  switch (action.action_type) {
    case "start_campaign":
    case "publish_campaign": {
      if (!campaign) return { error: "Campanha não encontrada." };
      const metrics = createInitialMetrics(campaign.id);
      await adsRepo.update(campaign.id, { status: "active" });
      const { data: existing } = await monitorsRepo.findByCampaignId(campaign.id);
      if (existing) {
        await monitorsRepo.update(existing.id, {
          monitor_status: "active",
          metrics: metrics as unknown as Json,
          last_evaluated_at: new Date().toISOString(),
        });
      } else {
        await monitorsRepo.create({
          campaign_id: campaign.id,
          monitor_status: "active",
          metrics: metrics as unknown as Json,
          last_evaluated_at: new Date().toISOString(),
        });
      }
      return { error: null, result: { status: "active", metrics } };
    }
    case "pause_campaign": {
      if (!campaign) return { error: "Campanha não encontrada." };
      await executeCampaignMutation(adsRepo, monitorsRepo, campaign, "paused");
      return { error: null, result: { status: "paused" } };
    }
    case "resume_campaign": {
      if (!campaign) return { error: "Campanha não encontrada." };
      await executeCampaignMutation(adsRepo, monitorsRepo, campaign, "active");
      return { error: null, result: { status: "active" } };
    }
    case "duplicate_campaign": {
      if (!campaign) return { error: "Campanha não encontrada." };
      const { data: copy, error } = await adsRepo.create({
        product_id: campaign.product_id,
        asset_id: campaign.asset_id,
        landing_id: campaign.landing_id,
        copylab_id: campaign.copylab_id,
        status: "draft",
        nome: `${campaign.nome ?? campaign.campanha_nome ?? "Campanha"} (cópia)`,
        avatar: campaign.avatar,
        problema: campaign.problema,
        solucao: campaign.solucao,
        promessa: campaign.promessa,
        diferencial: campaign.diferencial,
        preco: campaign.preco,
        objetivo: campaign.objetivo,
        orcamento_nivel: campaign.orcamento_nivel,
        investimento_diario_min: campaign.investimento_diario_min,
        investimento_diario_max: campaign.investimento_diario_max,
        investimento_mensal_previsto: campaign.investimento_mensal_previsto,
        campanha_nome: `${campaign.campanha_nome ?? "Campanha"} (cópia)`,
        campanha_estrategia: campaign.campanha_estrategia,
        publicos: campaign.publicos,
        conjuntos_anuncios: campaign.conjuntos_anuncios,
        anuncios: campaign.anuncios,
      });
      if (error || !copy) return { error: error ?? "Erro ao duplicar campanha." };
      return { error: null, result: { campaignId: copy.id } };
    }
    case "generate_copy": {
      if (!campaign) return { error: "Campanha não encontrada." };
      const intake = intakeFromCampaign(campaign);
      const { record, error } = await generateCopylab(intake);
      if (error || !record) return { error: error ?? "Erro ao gerar copy." };
      await adsRepo.update(campaign.id, { copylab_id: record.id });
      return { error: null, result: { copylabId: record.id } };
    }
    case "generate_creative": {
      if (!campaign) return { error: "Campanha não encontrada." };
      const intake = intakeFromCampaign(campaign);
      const { record, error } = await generateStudioAssets(
        {
          ...intake,
          asset_id: campaign.asset_id,
        },
        "criativo"
      );
      if (error || !record) return { error: error ?? "Erro ao gerar criativo." };
      await adsRepo.update(campaign.id, { asset_id: record.id });
      return { error: null, result: { assetId: record.id } };
    }
    case "suggest_scale":
    case "alert_budget":
    case "alert_ctr":
    case "alert_cpa":
    case "alert_frequency":
      return { error: null, result: { notified: true } };
    case "increase_budget":
      return { error: "Aumento de orçamento requer aprovação manual no Ads Manager." };
    default:
      return { error: `Ação não suportada: ${action.action_type}` };
  }
}

function resolveActionStatus(
  controlLevel: AutopilotControlLevel,
  actionType: string,
  triggerType: "manual" | "rule" | "ai"
): AutopilotAction["status"] {
  if (triggerType === "manual") {
    return actionRequiresApproval(actionType) ? "pending_approval" : "approved";
  }
  if (controlLevel === "manual") return "suggested";
  if (controlLevel === "suggest") return "suggested";
  if (controlLevel === "prepare") return "pending_approval";
  if (controlLevel === "execute_approved" && isSafeAutoAction(actionType)) {
    return "auto_executed";
  }
  return "pending_approval";
}

export async function getAutopilotDashboard(): Promise<{
  dashboard: AutopilotDashboardMetrics | null;
  settings: AutopilotSettings | null;
  rules: AutopilotRules;
  campaigns: CreatorAdsCampaign[];
  monitors: AutopilotMonitor[];
  actions: AutopilotAction[];
  logs: AutopilotLog[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: null,
      settings: null,
      rules: DEFAULT_AUTOPILOT_RULES,
      campaigns: [],
      monitors: [],
      actions: [],
      logs: [],
      error: "Usuário não autenticado.",
    };
  }

  const settingsRepo = new AutopilotSettingsRepository(ctx.supabase, ctx.userId);
  const monitorsRepo = new AutopilotMonitorsRepository(ctx.supabase, ctx.userId);
  const actionsRepo = new AutopilotActionsRepository(ctx.supabase, ctx.userId);
  const logsRepo = new AutopilotLogsRepository(ctx.supabase, ctx.userId);

  const [settings, { records: campaigns, error: adsError }, monitorsRes, actionsRes, logsRes] =
    await Promise.all([
      ensureSettings(settingsRepo),
      loadAdsCampaigns(),
      monitorsRepo.findAllOrdered(),
      actionsRepo.findAllOrdered(),
      logsRepo.findAllOrdered(),
    ]);

  if (adsError) {
    return {
      dashboard: null,
      settings,
      rules: parseAutopilotRules(settings.rules),
      campaigns: [],
      monitors: monitorsRes.data ?? [],
      actions: actionsRes.data ?? [],
      logs: logsRes.data ?? [],
      error: adsError,
    };
  }

  const monitors = monitorsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const logs = logsRes.data ?? [];
  const rules = parseAutopilotRules(settings.rules);
  const dashboard = computeAutopilotDashboard({
    campaigns: campaigns ?? [],
    monitors,
    actions,
    settings,
  });

  return {
    dashboard,
    settings,
    rules,
    campaigns: campaigns ?? [],
    monitors,
    actions,
    logs,
    error: null,
  };
}

export async function updateAutopilotSettings(input: {
  control_level?: AutopilotControlLevel;
  rules?: AutopilotRules;
}): Promise<{ settings: AutopilotSettings | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { settings: null, error: "Usuário não autenticado." };

  const settingsRepo = new AutopilotSettingsRepository(ctx.supabase, ctx.userId);
  const current = await ensureSettings(settingsRepo);

  const { data, error } = await settingsRepo.upsert({
    control_level: input.control_level ?? current.control_level,
    rules: (input.rules ?? parseAutopilotRules(current.rules)) as unknown as Json,
  });

  if (error) return { settings: null, error };
  await logAutopilot(ctx, {
    eventType: "settings_updated",
    mensagem: "Configurações do Autopilot atualizadas",
    detalhes: { control_level: data?.control_level },
  });
  return { settings: data, error: null };
}

export async function runManualAutopilotAction(input: {
  campaignId: string;
  actionType: ManualActionType;
}): Promise<{ action: AutopilotAction | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { action: null, error: "Usuário não autenticado." };

  const adsRepo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const settingsRepo = new AutopilotSettingsRepository(ctx.supabase, ctx.userId);
  const actionsRepo = new AutopilotActionsRepository(ctx.supabase, ctx.userId);
  const notificationsRepo = new NotificationsRepository(ctx.supabase, ctx.userId);

  const [{ data: campaign }, settings] = await Promise.all([
    adsRepo.findById(input.campaignId),
    ensureSettings(settingsRepo),
  ]);

  if (!campaign) return { action: null, error: "Campanha não encontrada." };

  const status = resolveActionStatus(settings.control_level, input.actionType, "manual");
  const requiresApproval = actionRequiresApproval(input.actionType);

  const { data: action, error: createError } = await actionsRepo.create({
    campaign_id: campaign.id,
    action_type: input.actionType,
    trigger_type: "manual",
    rule_key: null,
    status: requiresApproval ? "pending_approval" : status,
    requires_approval: requiresApproval,
    metric_detected: null,
    metric_value: null,
    reason: `Ação manual: ${input.actionType}`,
    suggestion: null,
    payload: {},
  } satisfies Omit<TableInsert<"autopilot_actions">, "user_id">);

  if (createError || !action) {
    return { action: null, error: createError ?? "Erro ao registrar ação." };
  }

  await logAutopilot(ctx, {
    eventType: "manual_action",
    mensagem: `Ação manual registrada: ${input.actionType}`,
    detalhes: { actionId: action.id, campaignId: campaign.id },
    campaignId: campaign.id,
    actionId: action.id,
  });

  if (requiresApproval || status === "pending_approval") {
    await createAutopilotNotification({
      repo: notificationsRepo,
      type: "autopilot_action_required",
      title: "Autopilot: aprovação necessária",
      message: `Ação "${input.actionType}" aguarda sua aprovação para a campanha ${campaign.nome ?? campaign.campanha_nome ?? ""}.`,
      actionId: action.id,
      campaignId: campaign.id,
    });
    return { action, error: null };
  }

  const exec = await executeActionBody(ctx, action, campaign);
  if (exec.error) {
    await actionsRepo.update(action.id, { status: "rejected", reason: exec.error });
    return { action: null, error: exec.error };
  }

  await actionsRepo.update(action.id, {
    status: "executed",
    executed_at: new Date().toISOString(),
    payload: (exec.result ?? {}) as Json,
  });

  await awardAuraXp("autopilot_acao_executar", `autopilot-manual:${action.id}`);
  await logAutopilot(ctx, {
    eventType: "action_executed",
    mensagem: `Ação manual executada: ${input.actionType}`,
    detalhes: { actionId: action.id, result: exec.result },
    campaignId: campaign.id,
    actionId: action.id,
    tipo: "success",
  });

  return { action, error: null };
}

export async function approveAutopilotAction(
  actionId: string
): Promise<{ action: AutopilotAction | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { action: null, error: "Usuário não autenticado." };

  const adsRepo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const actionsRepo = new AutopilotActionsRepository(ctx.supabase, ctx.userId);

  const { data: action } = await actionsRepo.findById(actionId);
  if (!action) return { action: null, error: "Ação não encontrada." };

  if (action.action_type === "increase_budget" || action.action_type === "publish_campaign") {
    if (action.trigger_type === "rule") {
      return {
        action: null,
        error: "Publicação e aumento de orçamento por regra exigem confirmação explícita.",
      };
    }
  }

  const campaign = action.campaign_id
    ? (await adsRepo.findById(action.campaign_id)).data
    : null;

  const exec = await executeActionBody(ctx, action, campaign);
  if (exec.error) {
    await actionsRepo.update(action.id, { status: "rejected", reason: exec.error });
    return { action: null, error: exec.error };
  }

  const { data: updated, error } = await actionsRepo.update(action.id, {
    status: "executed",
    executed_at: new Date().toISOString(),
    payload: (exec.result ?? {}) as Json,
  });

  await logAutopilot(ctx, {
    eventType: "action_approved",
    mensagem: `Ação aprovada e executada: ${action.action_type}`,
    detalhes: { actionId: action.id, result: exec.result },
    campaignId: action.campaign_id,
    actionId: action.id,
    tipo: "success",
  });

  await awardAuraXp("autopilot_acao_executar", `autopilot-approved:${action.id}`);
  return { action: updated, error };
}

export async function rejectAutopilotAction(
  actionId: string
): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const actionsRepo = new AutopilotActionsRepository(ctx.supabase, ctx.userId);
  const { error } = await actionsRepo.update(actionId, { status: "rejected" });
  await logAutopilot(ctx, {
    eventType: "action_rejected",
    mensagem: "Ação rejeitada pelo usuário",
    detalhes: { actionId },
    actionId,
    tipo: "warning",
  });
  return { error };
}

type RuleEvaluation = {
  ruleKey: AutopilotRuleKey;
  actionType: AutopilotAction["action_type"];
  metricDetected: string;
  metricValue: number;
  reason: string;
  suggestion: string;
};

function evaluateMetricsAgainstRules(
  metrics: CampaignMetrics,
  rules: AutopilotRules
): RuleEvaluation[] {
  const hits: RuleEvaluation[] = [];

  if (
    rules.pause_low_ctr.enabled &&
    isCtrLowForHours(metrics, rules.pause_low_ctr.threshold)
  ) {
    hits.push({
      ruleKey: "pause_low_ctr",
      actionType: "pause_campaign",
      metricDetected: "CTR",
      metricValue: metrics.ctr,
      reason: `CTR ${metrics.ctr}% abaixo de ${rules.pause_low_ctr.threshold}% por 48h`,
      suggestion: "Pausar campanha e revisar criativo/copy com IA.",
    });
  }

  if (rules.pause_high_cpa.enabled && metrics.cpa > rules.pause_high_cpa.threshold) {
    hits.push({
      ruleKey: "pause_high_cpa",
      actionType: "pause_campaign",
      metricDetected: "CPA",
      metricValue: metrics.cpa,
      reason: `CPA R$${metrics.cpa} acima do limite R$${rules.pause_high_cpa.threshold}`,
      suggestion: "Pausar campanha e ajustar público ou oferta.",
    });
  }

  if (
    rules.alert_fast_budget.enabled &&
    metrics.budget_spent_pct > rules.alert_fast_budget.threshold
  ) {
    hits.push({
      ruleKey: "alert_fast_budget",
      actionType: "alert_budget",
      metricDetected: "Orçamento",
      metricValue: metrics.budget_spent_pct,
      reason: `Orçamento ${metrics.budget_spent_pct}% consumido rapidamente`,
      suggestion: "Revise pacing e considere pausar conjuntos com pior CPA.",
    });
  }

  if (rules.suggest_scale_roas.enabled && metrics.roas >= rules.suggest_scale_roas.threshold) {
    hits.push({
      ruleKey: "suggest_scale_roas",
      actionType: "suggest_scale",
      metricDetected: "ROAS",
      metricValue: metrics.roas,
      reason: `ROAS ${metrics.roas}x acima do limite ${rules.suggest_scale_roas.threshold}x`,
      suggestion: "Considere escalar gradualmente — requer aprovação para aumento de orçamento.",
    });
  }

  if (
    rules.suggest_new_creative.enabled &&
    metrics.frequency >= rules.suggest_new_creative.threshold
  ) {
    hits.push({
      ruleKey: "suggest_new_creative",
      actionType: "generate_creative",
      metricDetected: "Frequência",
      metricValue: metrics.frequency,
      reason: `Frequência ${metrics.frequency} indica saturação de criativo`,
      suggestion: "Gerar novo criativo no Creative Studio.",
    });
  }

  return hits;
}

export async function evaluateAutopilotRules(): Promise<{
  evaluated: number;
  triggered: number;
  actions: AutopilotAction[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { evaluated: 0, triggered: 0, actions: [], error: "Usuário não autenticado." };
  }

  const settingsRepo = new AutopilotSettingsRepository(ctx.supabase, ctx.userId);
  const monitorsRepo = new AutopilotMonitorsRepository(ctx.supabase, ctx.userId);
  const actionsRepo = new AutopilotActionsRepository(ctx.supabase, ctx.userId);
  const adsRepo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const notificationsRepo = new NotificationsRepository(ctx.supabase, ctx.userId);

  const [settings, monitorsRes] = await Promise.all([
    ensureSettings(settingsRepo),
    monitorsRepo.findAllOrdered(),
  ]);

  const rules = parseAutopilotRules(settings.rules);
  const monitors = (monitorsRes.data ?? []).filter((m) => m.monitor_status === "active");
  const createdActions: AutopilotAction[] = [];

  for (const monitor of monitors) {
    const previous = parseCampaignMetrics(monitor.metrics);
    const evolved = evolveMetrics(monitor.campaign_id, previous);
    const metrics = trackCtrLowSince(evolved, rules.pause_low_ctr.threshold);

    await monitorsRepo.update(monitor.id, {
      metrics: metrics as unknown as Json,
      last_evaluated_at: new Date().toISOString(),
    });

    const hits = evaluateMetricsAgainstRules(metrics, rules);
    const { data: campaign } = await adsRepo.findById(monitor.campaign_id);

    for (const hit of hits) {
      const status = resolveActionStatus(settings.control_level, hit.actionType, "rule");
      const requiresApproval =
        actionRequiresApproval(hit.actionType) ||
        (hit.actionType === "pause_campaign" && settings.control_level !== "execute_approved");

      const { data: action, error } = await actionsRepo.create({
        campaign_id: monitor.campaign_id,
        action_type: hit.actionType,
        trigger_type: "rule",
        rule_key: hit.ruleKey,
        status,
        requires_approval: requiresApproval,
        metric_detected: hit.metricDetected,
        metric_value: hit.metricValue,
        reason: hit.reason,
        suggestion: hit.suggestion,
        payload: { metrics } as unknown as Json,
      } satisfies Omit<TableInsert<"autopilot_actions">, "user_id">);

      if (error || !action) continue;
      createdActions.push(action);

      const notifType: NotificationType =
        hit.actionType === "pause_campaign"
          ? "autopilot_campaign_paused"
          : hit.actionType === "suggest_scale"
            ? "autopilot_opportunity_found"
            : "autopilot_rule_triggered";

      const notifTitle =
        hit.actionType === "suggest_scale"
          ? "Autopilot: oportunidade de escala"
          : hit.actionType === "pause_campaign"
            ? "Autopilot: anúncio com baixa performance"
            : `Autopilot: ${hit.metricDetected} detectado`;

      await createAutopilotNotification({
        repo: notificationsRepo,
        type: notifType,
        title: notifTitle,
        message: `${hit.reason}. ${hit.suggestion}`,
        actionId: action.id,
        campaignId: monitor.campaign_id,
      });

      const logEventType: AutopilotLogEventType =
        hit.actionType === "suggest_scale"
          ? "opportunity_found"
          : hit.actionType === "pause_campaign" || hit.ruleKey === "pause_high_cpa"
            ? "bad_ad_detected"
            : "rule_triggered";

      await logAutopilot(ctx, {
        eventType: logEventType,
        mensagem: `Regra acionada: ${hit.ruleKey}`,
        detalhes: { actionId: action.id, campaignId: monitor.campaign_id, metrics },
        campaignId: monitor.campaign_id,
        actionId: action.id,
      });

      if (
        status === "auto_executed" &&
        hit.actionType === "pause_campaign" &&
        rules[hit.ruleKey]?.enabled &&
        campaign
      ) {
        await executeActionBody(ctx, action, campaign);
        await actionsRepo.update(action.id, {
          status: "auto_executed",
          executed_at: new Date().toISOString(),
        });
      }
    }
  }

  if (createdActions.length > 0) {
    await awardAuraXp("autopilot_regras_avaliar", `autopilot-eval:${todayIsoDate()}`);
  }

  return {
    evaluated: monitors.length,
    triggered: createdActions.length,
    actions: createdActions,
    error: null,
  };
}

export async function fixAutopilotWithAi(input: {
  actionId?: string;
  message?: string;
}): Promise<{ text: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { text: "", error: "Usuário não autenticado." };

  const openai = getOpenAi();
  const [dash, brain, perf] = await Promise.all([
    getAutopilotDashboard(),
    buildAuraContext(),
    getPerformanceDashboard().catch(() => null),
  ]);

  const context = [
    brain.context,
    buildAutopilotAuraContext({
    dashboard: dash.dashboard ?? computeAutopilotDashboard({
      campaigns: dash.campaigns,
      monitors: dash.monitors,
      actions: dash.actions,
      settings: dash.settings,
    }),
    campaigns: dash.campaigns,
    monitors: dash.monitors,
    actions: dash.actions,
    settings: dash.settings,
    }),
  ].join("\n\n");

  const actionContext = input.actionId
    ? dash.actions.find((a) => a.id === input.actionId)
    : null;

  const userPrompt = [
    input.message ?? "Sugira correções práticas para o problema detectado.",
    actionContext
      ? `Ação: ${actionContext.action_type}\nMotivo: ${actionContext.reason}\nMétrica: ${actionContext.metric_detected} = ${actionContext.metric_value}\nSugestão atual: ${actionContext.suggestion}`
      : "",
    perf?.dashboard ? `Performance score: ${perf.dashboard.scorePerformance ?? "—"}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!openai) {
    return {
      text: actionContext?.suggestion ??
        "Revise criativo e copy. Considere pausar campanhas com CPA alto e testar novos anúncios.",
      error: null,
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é a Aura Autopilot. Nunca sugira aumentar orçamento ou publicar sem aprovação.\n\n${context}`,
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    });
    return {
      text: response.choices[0]?.message?.content ?? "Sem resposta da IA.",
      error: null,
    };
  } catch (err) {
    return {
      text: "",
      error: err instanceof Error ? err.message : "Erro na IA.",
    };
  }
}

export async function getAutopilotContext(): Promise<{ context: string; error: string | null }> {
  const [dash, brain] = await Promise.all([
    getAutopilotDashboard(),
    buildAuraContext(),
  ]);
  if (dash.error) return { context: "", error: dash.error };

  const autopilotBlock = buildAutopilotAuraContext({
    dashboard: dash.dashboard ?? computeAutopilotDashboard({
      campaigns: dash.campaigns,
      monitors: dash.monitors,
      actions: dash.actions,
      settings: dash.settings,
    }),
    campaigns: dash.campaigns,
    monitors: dash.monitors,
    actions: dash.actions,
    settings: dash.settings,
  });

  return {
    context: [brain.context, autopilotBlock].filter(Boolean).join("\n\n"),
    error: null,
  };
}

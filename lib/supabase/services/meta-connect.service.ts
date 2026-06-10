import { decryptCredentials, encryptCredentials } from "@/lib/crypto/credentials";
import {
  duplicateMetaCampaign,
  fetchMetaCampaignInsights,
  listMetaAdAccounts,
  listMetaCampaigns,
  testMetaConnection,
  updateMetaCampaignStatus,
} from "@/lib/meta/meta.client";
import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import { generateStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import {
  MetaAdAccountsRepository,
  MetaCampaignMetricsRepository,
  MetaCampaignsRepository,
  MetaConnectionsRepository,
} from "@/lib/supabase/repositories/meta.repository";
import type { Json, MetaCampaign, MetaCampaignMetric } from "@/types/database";
import { todayIsoDate } from "@/utils/health";
import type { MetaCampaignAction } from "@/utils/integrations";
import { getOptionalDataContext } from "./context";
import { logIntegrationAction } from "./integration-logs.service";
import { recordPlatformResult } from "./platform-results.service";

function getAccessToken(encrypted: string): string {
  const creds = decryptCredentials(encrypted);
  const token = creds.access_token?.trim();
  if (!token) throw new Error("Token Meta inválido.");
  return token;
}

export async function getMetaConnectDashboard() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." as const, data: null };

  const connRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const accountsRepo = new MetaAdAccountsRepository(ctx.supabase, ctx.userId);
  const campaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
  const metricsRepo = new MetaCampaignMetricsRepository(ctx.supabase, ctx.userId);

  const [connection, accountsRes, campaignsRes] = await Promise.all([
    connRepo.findForUser(),
    accountsRepo.findAllOrdered(),
    campaignsRepo.findAllOrdered(),
  ]);

  const campaigns = campaignsRes.data ?? [];
  const metricsMap: Record<string, MetaCampaignMetric> = {};
  for (const campaign of campaigns.slice(0, 20)) {
    const { data: metric } = await metricsRepo.findLatestForCampaign(campaign.id);
    if (metric) metricsMap[campaign.id] = metric;
  }

  return {
    error: null,
    data: {
      connection: connection.data,
      adAccounts: accountsRes.data ?? [],
      campaigns,
      metricsMap,
      activeCampaigns: campaigns.filter((c) => c.status === "active").length,
      pausedCampaigns: campaigns.filter((c) => c.status === "paused").length,
    },
  };
}

export async function connectMetaBusiness(params: {
  accessToken: string;
  businessId?: string;
  businessName?: string;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const token = params.accessToken.trim();
  if (!token) return { error: "Access token obrigatório." };

  try {
    const test = await testMetaConnection(token);
    const encrypted = encryptCredentials({ access_token: token });
    const connRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
    const existing = await connRepo.findForUser();

    const payload = {
      business_id: params.businessId?.trim() || null,
      business_name: params.businessName?.trim() || test.label || null,
      access_token_encrypted: encrypted,
      token_expires_at: null,
      status: "connected" as const,
      last_error: null,
      last_sync_at: null,
      scopes: ["ads_management", "ads_read"],
      metadata: {} as Json,
    };

    if (existing.data) {
      const { error } = await connRepo.update(existing.data.id, payload);
      if (error) return { error };
    } else {
      const { error } = await connRepo.create(payload);
      if (error) return { error };
    }

    await logIntegrationAction({
      platform: "meta",
      actionType: "connect",
      status: "success",
      message: "Meta Business conectado com sucesso.",
    });

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao conectar Meta.";
    await logIntegrationAction({
      platform: "meta",
      actionType: "connect",
      status: "error",
      message,
    });
    return { error: message };
  }
}

export async function disconnectMetaBusiness() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const connRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const existing = await connRepo.findForUser();
  if (!existing.data) return { error: null };

  await connRepo.update(existing.data.id, {
    status: "disconnected",
    access_token_encrypted: "",
    last_error: null,
  });

  await logIntegrationAction({
    platform: "meta",
    actionType: "disconnect",
    status: "success",
    message: "Meta Business desconectado.",
  });

  return { error: null };
}

export async function syncMetaConnection() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const connRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const { data: connection } = await connRepo.findForUser();
  if (!connection || connection.status !== "connected") {
    return { error: "Conecte Meta Business primeiro." };
  }

  try {
    const token = getAccessToken(connection.access_token_encrypted);
    const accountsRepo = new MetaAdAccountsRepository(ctx.supabase, ctx.userId);
    const campaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
    const metricsRepo = new MetaCampaignMetricsRepository(ctx.supabase, ctx.userId);

    const accounts = await listMetaAdAccounts(token);
    for (const account of accounts) {
      const existing = await ctx.supabase
        .from("meta_ad_accounts")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("external_account_id", account.externalAccountId)
        .maybeSingle();

      const accountPayload = {
        connection_id: connection.id,
        external_account_id: account.externalAccountId,
        name: account.name,
        currency: account.currency,
        timezone: account.timezone,
        status: account.status,
        last_synced_at: new Date().toISOString(),
        metadata: {} as Json,
      };

      if (existing.data?.id) {
        await accountsRepo.update(existing.data.id, accountPayload);
      } else {
        await accountsRepo.create(accountPayload);
      }

      const remoteCampaigns = await listMetaCampaigns(token, account.externalAccountId);
      for (const remote of remoteCampaigns) {
        const local = await campaignsRepo.findByExternalId(remote.externalCampaignId);
        const campaignPayload = {
          connection_id: connection.id,
          ad_account_id: existing.data?.id ?? null,
          external_campaign_id: remote.externalCampaignId,
          name: remote.name,
          status: remote.status,
          effective_status: remote.effectiveStatus,
          objective: remote.objective,
          daily_budget_cents: remote.dailyBudgetCents,
          currency: account.currency,
          last_synced_at: new Date().toISOString(),
          metadata: {} as Json,
        };

        let campaignId = local.data?.id;
        if (local.data) {
          await campaignsRepo.update(local.data.id, campaignPayload);
          campaignId = local.data.id;
        } else {
          const { data: created } = await campaignsRepo.create({
            ...campaignPayload,
            creator_campaign_id: null,
            aura_created: false,
            requires_approval: true,
            status: remote.status === "active" ? "paused" : remote.status,
          });
          campaignId = created?.id;
        }

        if (!campaignId) continue;

        const insights = await fetchMetaCampaignInsights(token, remote.externalCampaignId);
        const budgetPct =
          remote.dailyBudgetCents && remote.dailyBudgetCents > 0
            ? Math.min(100, (insights.spendCents / remote.dailyBudgetCents) * 100)
            : 0;

        await ctx.supabase.from("meta_campaign_metrics").upsert(
          {
            user_id: ctx.userId,
            campaign_id: campaignId,
            ctr: insights.ctr,
            cpa: insights.cpa,
            roas: insights.roas,
            spend_cents: insights.spendCents,
            impressions: insights.impressions,
            clicks: insights.clicks,
            conversions: insights.conversions,
            frequency: insights.clicks > 0 ? insights.impressions / insights.clicks : 0,
            budget_spent_pct: Math.round(budgetPct * 100) / 100,
            metrics_date: todayIsoDate(),
            raw_metrics: insights as unknown as Json,
          },
          { onConflict: "campaign_id,metrics_date" }
        );

        await recordPlatformResult({
          platform: "meta",
          resultType: "campaign_metrics",
          title: `Métricas Meta · ${remote.name}`,
          summary: `CTR ${insights.ctr}% · ROAS ${insights.roas}x`,
          valueCents: insights.spendCents,
          currency: account.currency,
          metrics: insights,
          sourceId: campaignId,
          sourceTable: "meta_campaigns",
        });
      }
    }

    await connRepo.update(connection.id, {
      last_sync_at: new Date().toISOString(),
      last_error: null,
    });

    await logIntegrationAction({
      platform: "meta",
      actionType: "sync",
      status: "success",
      message: "Sincronização Meta concluída.",
      details: { accounts: accounts.length },
    });

    return { error: null, synced: accounts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na sincronização Meta.";
    await connRepo.update(connection.id, { last_error: message, status: "error" });
    await logIntegrationAction({
      platform: "meta",
      actionType: "sync",
      status: "error",
      message,
    });
    return { error: message };
  }
}

export async function runMetaCampaignAction(params: {
  campaignId: string;
  action: MetaCampaignAction;
  approved?: boolean;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const connRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const campaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: connection } = await connRepo.findForUser();
  const { data: campaign } = await campaignsRepo.findById(params.campaignId);

  if (!connection || connection.status !== "connected") {
    return { error: "Conecte Meta Business primeiro." };
  }
  if (!campaign) return { error: "Campanha não encontrada." };

  const needsApproval =
    params.action === "start" ||
    params.action === "resume" ||
    campaign.requires_approval ||
    campaign.aura_created;

  if (needsApproval && !params.approved) {
    await logIntegrationAction({
      platform: "meta",
      actionType: params.action,
      status: "pending_approval",
      message: `Ação ${params.action} requer aprovação.`,
      details: { campaignId: params.campaignId },
    });
    return { error: "Esta ação requer aprovação explícita.", requiresApproval: true };
  }

  try {
    const token = getAccessToken(connection.access_token_encrypted);

    if (params.action === "generate_copy") {
      const { record, error } = await generateCopylab({
        nome: campaign.name,
        avatar: "",
        problema: "",
        solucao: "",
        promessa: "",
        diferencial: "",
        preco: null,
      });
      if (error) return { error };
      await logIntegrationAction({
        platform: "meta",
        actionType: "generate_copy",
        status: "success",
        message: "Nova copy gerada para campanha Meta.",
        details: { campaignId: params.campaignId, copylabId: record?.id },
      });
      return { error: null, result: { copylabId: record?.id } };
    }

    if (params.action === "generate_creative") {
      const { record, error } = await generateStudioAssets(
        {
          nome: campaign.name,
          avatar: "",
          problema: "",
          solucao: "",
          promessa: "",
          diferencial: "",
          preco: null,
        },
        "criativo"
      );
      if (error) return { error };
      await logIntegrationAction({
        platform: "meta",
        actionType: "generate_creative",
        status: "success",
        message: "Novo criativo gerado para campanha Meta.",
        details: { campaignId: params.campaignId, assetId: record?.id },
      });
      return { error: null, result: { assetId: record?.id } };
    }

    if (!campaign.external_campaign_id) {
      return { error: "Campanha sem ID externo Meta — sincronize primeiro." };
    }

    if (params.action === "pause") {
      await updateMetaCampaignStatus(token, campaign.external_campaign_id, "PAUSED");
      await campaignsRepo.update(campaign.id, { status: "paused" });
    } else if (params.action === "start" || params.action === "resume") {
      await updateMetaCampaignStatus(token, campaign.external_campaign_id, "ACTIVE");
      await campaignsRepo.update(campaign.id, { status: "active", requires_approval: false });
    } else if (params.action === "duplicate") {
      const copy = await duplicateMetaCampaign(token, campaign.external_campaign_id);
      await campaignsRepo.create({
        connection_id: connection.id,
        ad_account_id: campaign.ad_account_id,
        external_campaign_id: copy.copied_campaign_id ?? null,
        creator_campaign_id: null,
        name: `${campaign.name} (cópia)`,
        status: "paused",
        effective_status: "PAUSED",
        objective: campaign.objective,
        daily_budget_cents: campaign.daily_budget_cents,
        currency: campaign.currency,
        aura_created: true,
        requires_approval: true,
        last_synced_at: new Date().toISOString(),
        metadata: {} as Json,
      });
    }

    await logIntegrationAction({
      platform: "meta",
      actionType: params.action,
      status: "success",
      message: `Ação ${params.action} executada na campanha ${campaign.name}.`,
      details: { campaignId: params.campaignId },
    });

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na ação Meta.";
    await logIntegrationAction({
      platform: "meta",
      actionType: params.action,
      status: "error",
      message,
      details: { campaignId: params.campaignId },
    });
    return { error: message };
  }
}

export async function createAuraMetaCampaignDraft(params: {
  name: string;
  adAccountId?: string;
  objective?: string;
  dailyBudgetCents?: number;
  currency?: string;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado.", campaign: null };

  const connRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const campaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: connection } = await connRepo.findForUser();
  if (!connection) return { error: "Conecte Meta Business primeiro.", campaign: null };

  const { data: campaign, error } = await campaignsRepo.create({
    connection_id: connection.id,
    ad_account_id: params.adAccountId ?? null,
    external_campaign_id: null,
    creator_campaign_id: null,
    name: params.name,
    status: "paused",
    effective_status: "PAUSED",
    objective: params.objective ?? "OUTCOME_SALES",
    daily_budget_cents: params.dailyBudgetCents ?? null,
    currency: params.currency ?? "USD",
    aura_created: true,
    requires_approval: true,
    last_synced_at: null,
    metadata: { created_by: "aura" } as Json,
  });

  if (error) return { error, campaign: null };

  await logIntegrationAction({
    platform: "meta",
    actionType: "create_draft",
    status: "success",
    message: "Campanha Aura criada em modo pausado (requer aprovação para publicar).",
    details: { campaignId: campaign?.id },
  });

  return { error: null, campaign };
}

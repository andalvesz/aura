import { decryptCredentials, encryptCredentials } from "@/lib/crypto/credentials";
import { META_OAUTH_SCOPES } from "@/lib/meta";
import {
  duplicateMetaCampaign,
  fetchMetaCampaignInsights,
  listMetaAdAccounts,
  listMetaAds,
  listMetaAdSets,
  listMetaBusinessManagers,
  listMetaCampaigns,
  listMetaCustomAudiences,
  listMetaPages,
  listMetaPixels,
  testMetaConnection,
  updateMetaCampaignStatus,
  type MetaAd,
  type MetaAdSet,
  type MetaAudience,
  type MetaBusinessManager,
  type MetaPage,
  type MetaPixel,
} from "@/lib/meta/meta.client";
import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import { generateStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import {
  MetaAdAccountsRepository,
  MetaCampaignMetricsRepository,
  MetaCampaignsRepository,
  MetaConnectionsRepository,
} from "@/lib/supabase/repositories/meta.repository";
import { IntegrationConnectionsRepository } from "@/lib/supabase/repositories/integration-center.repository";
import type { IntegrationConnection, Json, MetaCampaign, MetaCampaignMetric } from "@/types/database";
import { todayIsoDate } from "@/utils/health";
import type { MetaCampaignAction } from "@/utils/integrations";
import { INTEGRATION_SYNC_INTERVAL_MS } from "@/utils/integrations";
import {
  computeMetaIntelligenceMetrics,
  META_READ_ONLY_MODE,
} from "@/utils/meta-intelligence";
import { getOptionalDataContext } from "./context";
import { logIntegrationAction } from "./integration-logs.service";
import { logIntegrationEvent } from "./integration-events.service";
import { recordPlatformResult } from "./platform-results.service";

function getAccessToken(encrypted: string): string {
  const creds = decryptCredentials(encrypted);
  const token = creds.access_token?.trim();
  if (!token) throw new Error("Token Meta inválido.");
  return token;
}

type MetaImportedMetadata = {
  businessManagers?: MetaBusinessManager[];
  pages?: MetaPage[];
  pixels?: MetaPixel[];
  importedAt?: string;
};

function readImportedFromMetadata(metadata: Json | null | undefined): MetaImportedMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const imported = (metadata as Record<string, unknown>).imported;
  if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
    return {};
  }
  const record = imported as Record<string, unknown>;
  return {
    businessManagers: Array.isArray(record.businessManagers)
      ? (record.businessManagers as MetaBusinessManager[])
      : [],
    pages: Array.isArray(record.pages) ? (record.pages as MetaPage[]) : [],
    pixels: Array.isArray(record.pixels) ? (record.pixels as MetaPixel[]) : [],
    importedAt: typeof record.importedAt === "string" ? record.importedAt : undefined,
  };
}

async function syncMetaIntegrationCenterStatus() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const metaRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const accountsRepo = new MetaAdAccountsRepository(ctx.supabase, ctx.userId);
  const campaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
  const integrationRepo = new IntegrationConnectionsRepository(ctx.supabase, ctx.userId);

  const [meta, accounts, campaigns, existing] = await Promise.all([
    metaRepo.findForUser(),
    accountsRepo.findAllOrdered(),
    campaignsRepo.findAllOrdered(),
    integrationRepo.findByPlatform("meta"),
  ]);

  const metaConn = meta.data;
  const accountList = accounts.data ?? [];
  const campaignList = campaigns.data ?? [];
  const imported = readImportedFromMetadata(metaConn?.metadata);
  const lastSyncAt = metaConn?.last_sync_at ?? null;
  const nextSyncAt = lastSyncAt
    ? new Date(new Date(lastSyncAt).getTime() + INTEGRATION_SYNC_INTERVAL_MS).toISOString()
    : null;

  const payload = {
    status: (metaConn?.status ?? "disconnected") as IntegrationConnection["status"],
    account_label: metaConn?.business_name ?? null,
    stats: {
      campaigns: campaignList.length,
      activeCampaigns: campaignList.filter((c) => c.status === "active").length,
      accounts: accountList.length,
      businessManagers: imported.businessManagers?.length ?? 0,
      pages: imported.pages?.length ?? 0,
      pixels: imported.pixels?.length ?? 0,
    } as Json,
    metadata: (metaConn?.metadata ?? {}) as Json,
    last_sync_at: lastSyncAt,
    next_sync_at: nextSyncAt,
    last_error: metaConn?.last_error ?? null,
  };

  if (existing.data) {
    await integrationRepo.update(existing.data.id, payload);
  } else {
    await integrationRepo.create({ platform: "meta", ...payload });
  }
}

async function fetchMetaLiveEntities(token: string, adAccountExternalIds: string[]) {
  const [businessManagers, pages] = await Promise.all([
    listMetaBusinessManagers(token).catch(() => [] as MetaBusinessManager[]),
    listMetaPages(token).catch(() => [] as MetaPage[]),
  ]);

  const pixels: MetaPixel[] = [];
  const adSets: MetaAdSet[] = [];
  const ads: MetaAd[] = [];
  const audiences: MetaAudience[] = [];

  for (const accountId of adAccountExternalIds.slice(0, 10)) {
    const [accountPixels, accountAdSets, accountAds, accountAudiences] = await Promise.all([
      listMetaPixels(token, accountId).catch(() => [] as MetaPixel[]),
      listMetaAdSets(token, accountId).catch(() => [] as MetaAdSet[]),
      listMetaAds(token, accountId).catch(() => [] as MetaAd[]),
      listMetaCustomAudiences(token, accountId).catch(() => [] as MetaAudience[]),
    ]);
    pixels.push(...accountPixels);
    adSets.push(...accountAdSets);
    ads.push(...accountAds);
    audiences.push(...accountAudiences);
  }

  return { businessManagers, pages, pixels, adSets, ads, audiences };
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

  const adAccounts = accountsRes.data ?? [];
  let businessManagers: MetaBusinessManager[] = [];
  let pages: MetaPage[] = [];
  let pixels: MetaPixel[] = [];
  let adSets: MetaAdSet[] = [];
  let ads: MetaAd[] = [];
  let audiences: MetaAudience[] = [];

  const cached = readImportedFromMetadata(connection.data?.metadata);

  if (connection.data?.status === "connected" && connection.data.access_token_encrypted) {
    try {
      const token = getAccessToken(connection.data.access_token_encrypted);
      const live = await fetchMetaLiveEntities(
        token,
        adAccounts.map((a) => a.external_account_id)
      );
      businessManagers = live.businessManagers;
      pages = live.pages;
      pixels = live.pixels;
      adSets = live.adSets;
      ads = live.ads;
      audiences = live.audiences;
    } catch {
      businessManagers = cached.businessManagers ?? [];
      pages = cached.pages ?? [];
      pixels = cached.pixels ?? [];
    }
  }

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const pausedCampaigns = campaigns.filter((c) => c.status === "paused").length;

  const intelligenceMetrics = computeMetaIntelligenceMetrics({
    connection: connection.data,
    adAccountsCount: adAccounts.length,
    campaignsCount: campaigns.length,
    activeCampaigns,
    pausedCampaigns,
    businessManagers,
    pages,
    pixels,
    audiences,
    adSets,
    ads,
    campaigns,
    metricsMap,
  });

  return {
    error: null,
    data: {
      connection: connection.data,
      adAccounts,
      campaigns,
      metricsMap,
      activeCampaigns,
      pausedCampaigns,
      businessManagers,
      pages,
      pixels,
      adSets,
      ads,
      audiences,
      metrics: intelligenceMetrics,
      readOnly: META_READ_ONLY_MODE,
    },
  };
}

export async function connectMetaBusiness(params: {
  accessToken: string;
  businessId?: string;
  businessName?: string;
  tokenExpiresAt?: string | null;
  scopes?: string[];
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
      token_expires_at: params.tokenExpiresAt ?? null,
      status: "connected" as const,
      last_error: null,
      last_sync_at: null,
      scopes: params.scopes ?? [...META_OAUTH_SCOPES],
      metadata: (existing.data?.metadata ?? {}) as Json,
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

    await logIntegrationEvent({
      platform: "meta",
      eventType: "connection",
      status: "success",
      title: "Meta conectado via OAuth",
      message: "Token criptografado e pronto para importação.",
    });

    await syncMetaIntegrationCenterStatus();

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

export async function importMetaOAuthEntities(accessToken?: string) {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { error: "Usuário não autenticado.", businessManagers: 0, adAccounts: 0, pages: 0, pixels: 0 };
  }

  const connRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const accountsRepo = new MetaAdAccountsRepository(ctx.supabase, ctx.userId);
  const { data: connection } = await connRepo.findForUser();

  if (!connection || connection.status !== "connected") {
    return {
      error: "Conecte Meta Business primeiro.",
      businessManagers: 0,
      adAccounts: 0,
      pages: 0,
      pixels: 0,
    };
  }

  try {
    const token =
      accessToken?.trim() || getAccessToken(connection.access_token_encrypted);

    const [businessManagers, pages, accounts] = await Promise.all([
      listMetaBusinessManagers(token),
      listMetaPages(token),
      listMetaAdAccounts(token),
    ]);

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
    }

    const pixels: MetaPixel[] = [];
    for (const account of accounts.slice(0, 10)) {
      const accountPixels = await listMetaPixels(token, account.externalAccountId).catch(
        () => [] as MetaPixel[]
      );
      pixels.push(...accountPixels);
    }

    const primaryBusiness = businessManagers[0];
    const metadata = {
      ...(typeof connection.metadata === "object" && connection.metadata && !Array.isArray(connection.metadata)
        ? (connection.metadata as Record<string, unknown>)
        : {}),
      imported: {
        businessManagers,
        pages,
        pixels,
        importedAt: new Date().toISOString(),
      },
    } as Json;

    await connRepo.update(connection.id, {
      business_id: primaryBusiness?.id ?? connection.business_id,
      business_name: primaryBusiness?.name ?? connection.business_name,
      last_sync_at: new Date().toISOString(),
      last_error: null,
      metadata,
    });

    await logIntegrationAction({
      platform: "meta",
      actionType: "import",
      status: "success",
      message: "Importação OAuth Meta concluída.",
      details: {
        businessManagers: businessManagers.length,
        adAccounts: accounts.length,
        pages: pages.length,
        pixels: pixels.length,
      },
    });

    await logIntegrationEvent({
      platform: "meta",
      eventType: "sync",
      status: "success",
      title: "Importação Meta OAuth",
      message: `${businessManagers.length} BM, ${accounts.length} contas, ${pages.length} páginas, ${pixels.length} pixels.`,
      details: {
        businessManagers: businessManagers.length,
        adAccounts: accounts.length,
        pages: pages.length,
        pixels: pixels.length,
      },
    });

    await syncMetaIntegrationCenterStatus();

    return {
      error: null,
      businessManagers: businessManagers.length,
      adAccounts: accounts.length,
      pages: pages.length,
      pixels: pixels.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na importação Meta.";
    await connRepo.update(connection.id, { last_error: message });
    await logIntegrationAction({
      platform: "meta",
      actionType: "import",
      status: "error",
      message,
    });
    await syncMetaIntegrationCenterStatus();
    return {
      error: message,
      businessManagers: 0,
      adAccounts: 0,
      pages: 0,
      pixels: 0,
    };
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

  await logIntegrationEvent({
    platform: "meta",
    eventType: "connection",
    status: "success",
    title: "Meta desconectado",
    message: "Credenciais removidas da Aura.",
  });

  await syncMetaIntegrationCenterStatus();

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
            frequency: insights.frequency,
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

    void import("./meta-intelligence.service")
      .then(({ feedMetaIntelligenceAfterSync }) => feedMetaIntelligenceAfterSync())
      .catch(() => undefined);

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
  if (META_READ_ONLY_MODE) {
    return {
      error: "Meta Connect está em modo somente leitura. Criação, edição e publicação não estão disponíveis.",
    };
  }

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
  if (META_READ_ONLY_MODE) {
    return {
      error: "Meta Connect está em modo somente leitura. Criação de campanhas não está disponível.",
      campaign: null,
    };
  }

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

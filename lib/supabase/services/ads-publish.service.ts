import { decryptCredentials } from "@/lib/crypto/credentials";
import {
  createMetaAd,
  createMetaAdCreative,
  createMetaAdSet,
  createMetaCampaign,
  listMetaPages,
} from "@/lib/meta/meta.client";
import { AdCampaignsRepository } from "@/lib/supabase/repositories/ad-campaigns.repository";
import { AdCreativesRepository } from "@/lib/supabase/repositories/ad-creatives.repository";
import { AdPlatformConnectionsRepository } from "@/lib/supabase/repositories/ad-platform-connections.repository";
import { AdSetsRepository } from "@/lib/supabase/repositories/ad-sets.repository";
import {
  MetaAdAccountsRepository,
  MetaCampaignsRepository,
  MetaConnectionsRepository,
} from "@/lib/supabase/repositories/meta.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import { logIntegrationAction } from "@/lib/supabase/services/integration-logs.service";
import { resolveMetaCreativeIdForAsset } from "@/lib/supabase/services/meta-upload.service";
import type { AdCampaign, AdCreative, AdPlatformConnection, AdSet, Database, Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADS_COMMANDER_SAFE_MODE,
  isAdsPublishEnabled,
  mergeAdsCommanderMetadata,
  requiresExplicitPublishApproval,
} from "@/utils/ads-commander";
import { readCheckoutUrlFromMetadata } from "@/utils/checkout-engine";
import { resolveCurrencyForMarket } from "@/utils/creator-locale";
import { validateLandingCta } from "@/utils/revenue-certification";
import { readGeneratedAssetId } from "@/utils/meta-upload";
import { getOptionalDataContext } from "./context";

function getMetaAccessToken(encrypted: string): string {
  const creds = decryptCredentials(encrypted);
  const token = creds.access_token?.trim();
  if (!token) throw new Error("Token Meta inválido.");
  return token;
}

function toDailyBudgetCents(amount: number | null | undefined): number {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 5000;
  return Math.round(value * 100);
}

function readMetaPageId(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const pageId = (metadata as Record<string, unknown>).page_id;
  return typeof pageId === "string" && pageId.trim() ? pageId.trim() : null;
}

export async function syncAdPlatformConnections(): Promise<{
  connections: AdPlatformConnection[];
  synced: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { connections: [], synced: 0, error: "Usuário não autenticado." };

  const platformRepo = new AdPlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const metaConnRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const metaAccountsRepo = new MetaAdAccountsRepository(ctx.supabase, ctx.userId);

  const { data: metaConnection } = await metaConnRepo.findForUser();
  let synced = 0;

  if (metaConnection?.status === "connected") {
    const { data: accounts } = await metaAccountsRepo.findAllOrdered();
    const activeAccounts = (accounts ?? []).filter((account) => account.status === "active");

    for (const [index, account] of activeAccounts.entries()) {
      const { data, error } = await platformRepo.upsertConnection({
        platform: "meta",
        meta_connection_id: metaConnection.id,
        platform_connection_id: null,
        external_account_id: account.external_account_id,
        account_label: account.name,
        status: "connected",
        is_default: index === 0,
        metadata: {
          currency: account.currency,
          timezone: account.timezone,
          source: "meta_connect",
        } as Json,
        last_sync_at: new Date().toISOString(),
      });
      if (!error && data) synced += 1;
    }
  }

  const { data: connections, error } = await platformRepo.findAllOrdered();
  return { connections: connections ?? [], synced, error };
}

export async function getAdPlatformConnections(): Promise<{
  connections: AdPlatformConnection[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { connections: [], error: "Usuário não autenticado." };

  const repo = new AdPlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  return { connections: data ?? [], error };
}

async function resolveCheckoutUrlForCampaign(
  campaign: AdCampaign,
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  if (campaign.landing_id) {
    const landingRepo = new LandingPagesRepository(supabase, userId);
    const { data: landing } = await landingRepo.findById(campaign.landing_id);
    const fromMetadata = readCheckoutUrlFromMetadata(landing?.metadata ?? null);
    if (fromMetadata) return fromMetadata;
  }

  if (campaign.operation_id) {
    const opRepo = new OperationCenterRepository(supabase, userId);
    const { data: operation } = await opRepo.findById(campaign.operation_id);
    if (operation?.product_id) {
      const { getCheckoutUrl } = await import("./checkout-engine.service");
      const { checkoutUrl } = await getCheckoutUrl(operation.product_id);
      return checkoutUrl;
    }
  }

  return null;
}

async function assertLandingCheckoutCta(
  campaign: AdCampaign,
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  if (!campaign.landing_id) return;

  const landingRepo = new LandingPagesRepository(supabase, userId);
  const { data: landing } = await landingRepo.findById(campaign.landing_id);
  const checkoutUrl = await resolveCheckoutUrlForCampaign(campaign, userId, supabase);

  if (!validateLandingCta(landing?.html, checkoutUrl)) {
    throw new Error("Landing CTA não aponta para checkout_url — sincronize checkout antes de publicar.");
  }
}

async function resolveLandingUrl(
  campaign: AdCampaign,
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  if (!campaign.landing_id) return null;

  const landingRepo = new LandingPagesRepository(supabase, userId);
  const { data: landing } = await landingRepo.findById(campaign.landing_id);
  return landing?.published_url ?? landing?.preview_url ?? null;
}

async function publishMetaCampaign(params: {
  campaign: AdCampaign;
  adSets: AdSet[];
  creatives: AdCreative[];
  connection: AdPlatformConnection;
  explicitApproval: boolean;
}): Promise<{ externalCampaignId: string; message: string }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) throw new Error("Usuário não autenticado.");

  const metaConnRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const { data: metaConnection } = await metaConnRepo.findForUser();
  if (!metaConnection || metaConnection.status !== "connected") {
    throw new Error("Conecte Meta Business em Platform Hub antes de publicar.");
  }

  const token = getMetaAccessToken(metaConnection.access_token_encrypted);
  const accountId = params.connection.external_account_id;

  let pageId = readMetaPageId(params.connection.metadata);
  if (!pageId) {
    const pages = await listMetaPages(token);
    pageId = pages[0]?.id ?? null;
    if (!pageId) {
      throw new Error("Nenhuma página Meta vinculada — necessária para publicar anúncios.");
    }
  }

  const landingUrl = await resolveLandingUrl(params.campaign, ctx.userId, ctx.supabase);
  if (!landingUrl?.trim()) {
    throw new Error("Campanha não pode ser publicada sem landing_url real.");
  }

  await assertLandingCheckoutCta(params.campaign, ctx.userId, ctx.supabase);

  const campaignCurrency = resolveCurrencyForMarket({
    country: params.campaign.country,
    language: params.campaign.language,
  });
  const campaignBudgetCents = toDailyBudgetCents(params.campaign.budget);

  const { externalCampaignId } = await createMetaCampaign(token, accountId, {
    name: params.campaign.campaign_name,
    objective: params.campaign.objective,
    status: "PAUSED",
  });

  const setRepo = new AdSetsRepository(ctx.supabase, ctx.userId);
  const creativeRepo = new AdCreativesRepository(ctx.supabase, ctx.userId);
  const publishedAdSets: string[] = [];
  const publishedAds: string[] = [];

  const sets = params.adSets.length > 0 ? params.adSets : [];
  const creatives = params.creatives.length > 0 ? params.creatives : [];

  if (sets.length === 0) {
    throw new Error("Campanha sem conjuntos de anúncios para publicar.");
  }
  if (creatives.length === 0) {
    throw new Error("Campanha sem criativos para publicar.");
  }

  for (const adSet of sets) {
    const setBudgetCents = toDailyBudgetCents(adSet.budget ?? params.campaign.budget);
    const audienceMeta =
      adSet.audience && typeof adSet.audience === "object" && !Array.isArray(adSet.audience)
        ? (adSet.audience as Record<string, unknown>)
        : {};
    const audienceName =
      typeof audienceMeta.name === "string" ? audienceMeta.name : `Conjunto ${adSet.id.slice(0, 6)}`;

    const { externalAdSetId } = await createMetaAdSet(token, accountId, {
      campaignId: externalCampaignId,
      name: audienceName,
      dailyBudgetCents: setBudgetCents || campaignBudgetCents,
      country: params.campaign.country,
      status: "PAUSED",
    });

    publishedAdSets.push(externalAdSetId);
    await setRepo.update(adSet.id, {
      metadata: mergeAdsCommanderMetadata(adSet.metadata, {
        external_ad_set_id: externalAdSetId,
        published_at: new Date().toISOString(),
      }),
    });

    for (const creative of creatives.slice(0, 3)) {
      const generatedAssetId = readGeneratedAssetId(creative.metadata);
      let externalCreativeId: string;

      if (generatedAssetId) {
        const upload = await resolveMetaCreativeIdForAsset(generatedAssetId, {
          connection: params.connection,
          pageId,
          linkUrl: landingUrl,
          headline: creative.headline,
          primaryText: creative.primary_text,
          description: creative.description,
          ctaType: creative.cta,
          explicitApproval: params.explicitApproval,
        });
        if (!upload.metaCreativeId) {
          throw new Error(upload.error ?? "Falha ao enviar criativo real para Meta.");
        }
        externalCreativeId = upload.metaCreativeId;
      } else {
        const created = await createMetaAdCreative(token, accountId, {
          name: creative.headline ?? params.campaign.campaign_name,
          pageId,
          linkUrl: landingUrl,
          headline: creative.headline ?? params.campaign.campaign_name,
          primaryText: creative.primary_text ?? creative.headline ?? params.campaign.campaign_name,
          description: creative.description,
          ctaType: creative.cta ?? undefined,
        });
        externalCreativeId = created.externalCreativeId;
      }

      const { externalAdId } = await createMetaAd(token, accountId, {
        name: creative.headline ?? `Anúncio ${creative.id.slice(0, 6)}`,
        adSetId: externalAdSetId,
        creativeId: externalCreativeId,
        status: "PAUSED",
      });

      publishedAds.push(externalAdId);
      await creativeRepo.update(creative.id, {
        metadata: mergeAdsCommanderMetadata(creative.metadata, {
          external_creative_id: externalCreativeId,
          external_ad_id: externalAdId,
          external_ad_set_id: externalAdSetId,
          published_at: new Date().toISOString(),
          generated_asset_id: generatedAssetId,
        }),
      });
    }
  }

  const metaCampaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
  const metaAccountsRepo = new MetaAdAccountsRepository(ctx.supabase, ctx.userId);
  const { data: metaAccounts } = await metaAccountsRepo.findAllOrdered();
  const metaAdAccount = (metaAccounts ?? []).find(
    (account) => account.external_account_id === params.connection.external_account_id
  );

  await metaCampaignsRepo.create({
    connection_id: metaConnection.id,
    ad_account_id: metaAdAccount?.id ?? null,
    external_campaign_id: externalCampaignId,
    creator_campaign_id: null,
    name: params.campaign.campaign_name,
    status: "paused",
    effective_status: "PAUSED",
    objective: params.campaign.objective,
    daily_budget_cents: campaignBudgetCents,
    currency: campaignCurrency,
    aura_created: true,
    requires_approval: !params.explicitApproval,
    last_synced_at: new Date().toISOString(),
    metadata: {
      ads_commander_campaign_id: params.campaign.id,
      ad_sets: publishedAdSets,
      ads: publishedAds,
      safe_mode: ADS_COMMANDER_SAFE_MODE.active,
    } as Json,
  });

  return {
    externalCampaignId,
    message: `Campanha publicada na Meta (PAUSED): ${publishedAdSets.length} conjunto(s), ${publishedAds.length} anúncio(s).`,
  };
}

export async function publishCampaign(
  campaignId: string,
  options?: { explicitApproval?: boolean; orchestratorMode?: "master_flow" | "manual" }
): Promise<{
  campaign: AdCampaign | null;
  message: string;
  error: string | null;
}> {
  const explicitApproval = options?.explicitApproval === true;
  const orchestratorMode = options?.orchestratorMode ?? "manual";

  if (requiresExplicitPublishApproval() && !explicitApproval) {
    console.info("[ads] publish failed", { campaignId, reason: "explicit_approval_required" });
    return {
      campaign: null,
      message: "",
      error: "Publicação requer aprovação explícita (SAFE_MODE ativo).",
    };
  }

  if (!isAdsPublishEnabled()) {
    if (orchestratorMode === "master_flow") {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return { campaign: null, message: "", error: "Usuário não autenticado." };
      }
      const campaignRepo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
      const { data: campaign } = await campaignRepo.findById(campaignId);
      return {
        campaign: campaign ?? null,
        message: "Campanha preparada — publicação externa desabilitada (ADS_PUBLISH_ENABLED).",
        error: null,
      };
    }
    console.info("[ads] publish failed", { campaignId, reason: "publish_disabled" });
    return {
      campaign: null,
      message: "",
      error: "Publicação desabilitada. Defina ADS_PUBLISH_ENABLED=true para publicar na plataforma.",
    };
  }

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { campaign: null, message: "", error: "Usuário não autenticado." };
  }

  const campaignRepo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: campaign } = await campaignRepo.findById(campaignId);
  if (!campaign) {
    return { campaign: null, message: "", error: "Campanha não encontrada." };
  }

  if (campaign.status !== "ready_to_publish") {
    console.info("[ads] publish failed", { campaignId, status: campaign.status });
    return {
      campaign: null,
      message: "",
      error: "Apenas campanhas com status READY_TO_PUBLISH podem ser publicadas.",
    };
  }

  if (campaign.publish_status === "published" && campaign.external_campaign_id) {
    return {
      campaign,
      message: "Campanha já publicada na plataforma.",
      error: null,
    };
  }

  const { requireExcellenceDelivery } = await import("./excellence-integration.service");
  const excellenceGate = await requireExcellenceDelivery("campaign", campaignId, {
    module: "ads-commander",
  });
  if (!excellenceGate.allowed) {
    console.info("[ads] publish failed", { campaignId, reason: "excellence_gate" });
    return {
      campaign: null,
      message: "",
      error: excellenceGate.error ?? "Campanha bloqueada pelo Specialist Engine.",
    };
  }

  const setRepo = new AdSetsRepository(ctx.supabase, ctx.userId);
  const creativeRepo = new AdCreativesRepository(ctx.supabase, ctx.userId);
  const [{ data: adSets }, { data: creatives }] = await Promise.all([
    setRepo.findByCampaignId(campaignId),
    creativeRepo.findByCampaignId(campaignId),
  ]);

  if (!adSets?.length || !creatives?.length) {
    console.info("[ads] publish failed", { campaignId, reason: "missing_children" });
    return {
      campaign: null,
      message: "",
      error: "Campanha incompleta — prepare conjuntos e criativos antes de publicar.",
    };
  }

  const landingUrl = await resolveLandingUrl(campaign, ctx.userId, ctx.supabase);
  if (!landingUrl?.trim()) {
    return {
      campaign: null,
      message: "",
      error: "Campanha não pode ser publicada sem landing_url real.",
    };
  }

  try {
    await assertLandingCheckoutCta(campaign, ctx.userId, ctx.supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Landing CTA inválida.";
    return { campaign: null, message: "", error: message };
  }

  await campaignRepo.update(campaignId, {
    status: "publishing",
    publish_status: "publishing",
    metadata: mergeAdsCommanderMetadata(campaign.metadata, {
      publish_started_at: new Date().toISOString(),
      explicit_approval: explicitApproval,
    }),
  });

  const platformRepo = new AdPlatformConnectionsRepository(ctx.supabase, ctx.userId);
  let connection =
    campaign.platform_connection_id
      ? (await platformRepo.findById(campaign.platform_connection_id)).data
      : null;

  if (!connection) {
    await syncAdPlatformConnections();
    connection = (await platformRepo.findDefaultForPlatform(campaign.platform)).data;
  }

  if (!connection || connection.status !== "connected") {
    await campaignRepo.update(campaignId, {
      status: "publish_failed",
      publish_status: "failed",
      metadata: mergeAdsCommanderMetadata(campaign.metadata, {
        publish_error: `Plataforma ${campaign.platform} não conectada.`,
      }),
    });
    console.info("[ads] publish failed", { campaignId, reason: "no_connection" });
    return {
      campaign: null,
      message: "",
      error: `Conecte ${campaign.platform} em Platform Hub antes de publicar.`,
    };
  }

  if (campaign.platform === "google" || campaign.platform === "tiktok") {
    await campaignRepo.update(campaignId, {
      status: "publish_failed",
      publish_status: "failed",
    });
    console.info("[ads] publish failed", { campaignId, reason: "platform_not_supported_yet" });
    return {
      campaign: null,
      message: "",
      error: `${campaign.platform} ainda não suporta publicação automática — fase 1: Meta Ads.`,
    };
  }

  try {
    const result = await publishMetaCampaign({
      campaign,
      adSets,
      creatives,
      connection,
      explicitApproval,
    });

    const { data: updated, error } = await campaignRepo.update(campaignId, {
      status: "published",
      publish_status: "published",
      platform_connection_id: connection.id,
      external_campaign_id: result.externalCampaignId,
      published_at: new Date().toISOString(),
      metadata: mergeAdsCommanderMetadata(campaign.metadata, {
        published_at: new Date().toISOString(),
        external_campaign_id: result.externalCampaignId,
        publish_note: result.message,
        explicit_approval: explicitApproval,
        safe_mode: ADS_COMMANDER_SAFE_MODE.active,
      }),
    });

    await logIntegrationAction({
      platform: "meta",
      actionType: "publish_campaign",
      status: "success",
      message: result.message,
      details: {
        campaignId,
        externalCampaignId: result.externalCampaignId,
        connectionId: connection.id,
      },
    });

    console.info("[ads] campaign published", {
      campaignId,
      platform: campaign.platform,
      externalCampaignId: result.externalCampaignId,
    });

    return {
      campaign: updated,
      message: result.message,
      error: error ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao publicar campanha.";
    await campaignRepo.update(campaignId, {
      status: "publish_failed",
      publish_status: "failed",
      metadata: mergeAdsCommanderMetadata(campaign.metadata, {
        publish_error: message,
        publish_failed_at: new Date().toISOString(),
      }),
    });

    await logIntegrationAction({
      platform: "meta",
      actionType: "publish_campaign",
      status: "error",
      message,
      details: { campaignId },
    });

    console.info("[ads] publish failed", { campaignId, error: message });
    return { campaign: null, message: "", error: message };
  }
}

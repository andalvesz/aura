import { recordSystemLog } from "@/lib/logs/record";
import { FunnelPagesRepository } from "@/lib/supabase/repositories/funnel-pages.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { ProductFactoryRepository } from "@/lib/supabase/repositories/product-factory.repository";
import { CreativeGeneratedAssetsRepository } from "@/lib/supabase/repositories/creative-generated-assets.repository";
import type { MasterFlow } from "@/types/database";
import { FUNNEL_PUBLISH_ORDER } from "@/utils/funnel-pages";
import { readMasterFlowMetadata } from "@/utils/master-flow";
import { computeProductQualityScore } from "@/utils/product-factory-pro";
import { computeLandingQualityScore } from "@/utils/landing-benchmark";
import { computeCampaignQualityScore } from "@/utils/ads-commander";
import { isCreativeGeneratedAssetDelivered } from "@/utils/creative-generated-assets";
import {
  evaluateReadyToSellCertification,
  type ReadyToSellCertification,
} from "@/utils/revenue-certification";
import { getOptionalDataContext } from "./context";

function readFunnelPrimaryUrl(metadata: MasterFlow["metadata"]): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const publish = (metadata as Record<string, unknown>).publish;
  if (!publish || typeof publish !== "object" || Array.isArray(publish)) return null;
  const urls = (publish as Record<string, unknown>).urls;
  if (!urls || typeof urls !== "object" || Array.isArray(urls)) return null;
  const map = urls as Record<string, unknown>;
  const primaryKey = FUNNEL_PUBLISH_ORDER[0];
  const primary = primaryKey ? map[primaryKey] : null;
  if (typeof primary === "string" && primary.trim()) return primary.trim();
  for (const value of Object.values(map)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function certifyReadyToSell(flow: MasterFlow): Promise<ReadyToSellCertification> {
  const meta = readMasterFlowMetadata(flow);
  const ctx = await getOptionalDataContext();

  let checkoutUrl = meta.checkout_url ?? null;
  let funnelUrl = meta.funnel_url ?? null;
  let landingUrl = meta.landing_url ?? null;
  let landingHtml: string | null = null;
  const campaignId = flow.campaign_id ?? meta.campaign_id ?? null;
  const excellenceScore = meta.excellence_score ?? null;
  let productQualityScore: number | null = null;
  let landingQualityScore: number | null = null;
  let campaignQualityScore: number | null = null;
  let creativeAssetDelivered = false;
  const certificationGaps: string[] = [];

  if (ctx && flow.product_id && !checkoutUrl) {
    const { getCheckoutUrl } = await import("./checkout-engine.service");
    const { checkoutUrl: resolved } = await getCheckoutUrl(flow.product_id);
    checkoutUrl = resolved ?? checkoutUrl;
  }

  if (ctx && meta.factory_id) {
    const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
    const { data: factory } = await factoryRepo.findById(meta.factory_id);
    if (factory) {
      const quality = computeProductQualityScore(factory);
      productQualityScore = quality.score;
      if (!quality.readyToSell) {
        certificationGaps.push(...quality.issues.slice(0, 3));
      }
    }
  }

  if (ctx && flow.funnel_id && (!funnelUrl || !landingUrl || !landingHtml)) {
    const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
    const pagesRepo = new FunnelPagesRepository(ctx.supabase, ctx.userId);
    const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);

    const { data: funnel } = await funnelsRepo.findById(flow.funnel_id);
    funnelUrl = funnelUrl ?? readFunnelPrimaryUrl(funnel?.metadata ?? null);

    const landingId = meta.landing_id;
    const { data: pages } = await pagesRepo.findByFunnelId(flow.funnel_id);
    const page = landingId
      ? pages?.find((item) => item.landing_page_id === landingId) ?? pages?.[0]
      : pages?.[0];

    if (page?.landing_page_id) {
      const { data: landing } = await landingRepo.findById(page.landing_page_id);
      landingUrl =
        landingUrl ?? landing?.published_url ?? landing?.preview_url ?? funnelUrl ?? null;
      landingHtml = landing?.html ?? null;
      if (landing) {
        landingQualityScore = computeLandingQualityScore({
          headline: landing.headline,
          subheadline: landing.subheadline,
          hero_copy: landing.hero_copy,
          benefits_json: landing.benefits_json,
          proof_json: landing.proof_json,
          offer_json: landing.offer_json,
          faq_json: landing.faq_json,
          cta_text: landing.cta_text,
        }).landing_quality_score;
      }
    }
    funnelUrl = funnelUrl ?? landingUrl;
  }

  if (ctx && meta.creative_asset_id) {
    const generatedRepo = new CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);
    const { data: generatedAsset } = await generatedRepo.findById(meta.creative_asset_id);
    creativeAssetDelivered = generatedAsset
      ? isCreativeGeneratedAssetDelivered(generatedAsset.status)
      : false;
  }

  if (ctx && campaignId) {
    const { AdCampaignsRepository } = await import("@/lib/supabase/repositories/ad-campaigns.repository");
    const { AdSetsRepository } = await import("@/lib/supabase/repositories/ad-sets.repository");
    const { AdCreativesRepository } = await import("@/lib/supabase/repositories/ad-creatives.repository");
    const campaignRepo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
    const setRepo = new AdSetsRepository(ctx.supabase, ctx.userId);
    const creativeRepo = new AdCreativesRepository(ctx.supabase, ctx.userId);
    const { data: campaign } = await campaignRepo.findById(campaignId);
    if (campaign) {
      const [{ data: adSets }, { data: creatives }] = await Promise.all([
        setRepo.findByCampaignId(campaignId),
        creativeRepo.findByCampaignId(campaignId),
      ]);
      campaignQualityScore = computeCampaignQualityScore({
        adSetsCount: adSets?.length ?? 0,
        creativesCount: creatives?.length ?? 0,
        audienceSuggestions: [],
        riskAnalysis: null,
        hasLanding: Boolean(landingUrl),
        hasCopy: true,
      }).campaign_quality_score;
    }
  }

  const certification = evaluateReadyToSellCertification({
    checkout_url: checkoutUrl,
    funnel_url: funnelUrl,
    landing_url: landingUrl,
    campaign_id: campaignId,
    excellence_score: excellenceScore,
    product_quality_score: productQualityScore,
    landing_quality_score: landingQualityScore,
    campaign_quality_score: campaignQualityScore,
    creative_asset_delivered: creativeAssetDelivered,
    landing_html: landingHtml,
    explicit_publish_approval: meta.explicit_publish_approval === true,
    certification_gaps: certificationGaps,
  });

  recordSystemLog({
    tipo: certification.ready ? "info" : "warning",
    modulo: "revenue-certification",
    mensagem: certification.ready
      ? "Negócio certificado READY_TO_SELL"
      : `Certificação incompleta: ${certification.gaps.join(", ")}`,
    detalhes: {
      flowId: flow.id,
      gaps: certification.gaps,
      requirements: certification.requirements,
    },
  });

  return certification;
}

export async function applyReadyToSellCertification(flow: MasterFlow): Promise<{
  certification: ReadyToSellCertification;
  status: MasterFlow["status"];
}> {
  const certification = await certifyReadyToSell(flow);
  const meta = readMasterFlowMetadata(flow);
  const needsApproval =
    meta.explicit_publish_approval !== true &&
    certification.gaps.some((gap) => gap.includes("aprovação explícita"));

  return {
    certification,
    status: certification.ready
      ? "ready_to_sell"
      : needsApproval
        ? "ready_for_approval"
        : "completed",
  };
}

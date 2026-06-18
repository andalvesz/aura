import { recordSystemLog } from "@/lib/logs/record";
import { AdCampaignsRepository } from "@/lib/supabase/repositories/ad-campaigns.repository";
import { FunnelPagesRepository } from "@/lib/supabase/repositories/funnel-pages.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import type { Json } from "@/types/database";
import { FUNNEL_PUBLISH_ORDER } from "@/utils/funnel-pages";
import {
  PUBLISH_ORCHESTRATOR_MASTER_FLOW,
  type PublishOrchestratorMode,
  type PublishOrchestratorResult,
} from "@/utils/publish-orchestrator";
import { getOptionalDataContext } from "./context";

function readPublishUrls(metadata: Json): Record<string, string> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const publish = (metadata as Record<string, unknown>).publish;
  if (!publish || typeof publish !== "object" || Array.isArray(publish)) return {};
  const urls = (publish as Record<string, unknown>).urls;
  if (!urls || typeof urls !== "object" || Array.isArray(urls)) return {};
  return Object.fromEntries(
    Object.entries(urls).filter(([, value]) => typeof value === "string" && value.trim())
  ) as Record<string, string>;
}

export async function orchestratePublish(params: {
  funnelId?: string | null;
  campaignId?: string | null;
  mode?: PublishOrchestratorMode;
}): Promise<{
  result: PublishOrchestratorResult;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      result: {
        funnelPublished: false,
        campaignPublished: false,
        funnelUrl: null,
        landingUrl: null,
        campaignId: params.campaignId ?? null,
        messages: [],
        warnings: ["Usuário não autenticado."],
      },
      error: "Usuário não autenticado.",
    };
  }

  const mode = params.mode ?? "manual";
  const messages: string[] = [];
  const warnings: string[] = [];
  let funnelPublished = false;
  let campaignPublished = false;
  let funnelUrl: string | null = null;
  let landingUrl: string | null = null;
  const campaignId = params.campaignId?.trim() ?? null;

  if (params.funnelId?.trim() && PUBLISH_ORCHESTRATOR_MASTER_FLOW.publishFunnel) {
    const { publishFunnel } = await import("./funnel-publish.service");
    const { result, error } = await publishFunnel(params.funnelId.trim());
    if (error) warnings.push(error);
    if (result) {
      funnelPublished = result.status === "published" || result.status === "partial";
      const salesPage =
        result.pages.find((page) => page.key === FUNNEL_PUBLISH_ORDER[0]) ?? result.pages[0];
      funnelUrl = salesPage?.url ?? null;
      landingUrl = salesPage?.url ?? null;
      messages.push(`Funil publicado (${result.status}).`);
    }
  }

  if (!funnelUrl && params.funnelId?.trim()) {
    const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
    const pagesRepo = new FunnelPagesRepository(ctx.supabase, ctx.userId);
    const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);

    const { data: funnel } = await funnelsRepo.findById(params.funnelId.trim());
    const urls = readPublishUrls(funnel?.metadata ?? {});
    const primaryKey = FUNNEL_PUBLISH_ORDER[0];
    funnelUrl = (primaryKey ? urls[primaryKey] : null) ?? Object.values(urls)[0] ?? null;

    if (!landingUrl) {
      const { data: pages } = await pagesRepo.findByFunnelId(params.funnelId.trim());
      const page = pages?.[0];
      if (page?.landing_page_id) {
        const { data: landing } = await landingRepo.findById(page.landing_page_id);
        landingUrl = landing?.published_url ?? landing?.preview_url ?? funnelUrl;
      }
    }
  }

  if (campaignId && PUBLISH_ORCHESTRATOR_MASTER_FLOW.publishCampaign) {
    const { publishCampaign } = await import("./ads-publish.service");
    const { campaign, message, error } = await publishCampaign(campaignId, {
      explicitApproval: mode === "master_flow" && PUBLISH_ORCHESTRATOR_MASTER_FLOW.bypassExplicitApproval,
      orchestratorMode: mode,
    } as { explicitApproval?: boolean; orchestratorMode?: PublishOrchestratorMode });

    if (error) {
      warnings.push(error);
    } else {
      campaignPublished = campaign?.publish_status === "published";
      if (message) messages.push(message);
    }

    if (!landingUrl && campaignId) {
      const campaignRepo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
      const { data: campaign } = await campaignRepo.findById(campaignId);
      if (campaign?.landing_id) {
        const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);
        const { data: landing } = await landingRepo.findById(campaign.landing_id);
        landingUrl = landing?.published_url ?? landing?.preview_url ?? landingUrl;
      }
    }
  }

  recordSystemLog({
    tipo: "info",
    modulo: "publish-orchestrator",
    mensagem: "Publicação orquestrada",
    detalhes: {
      mode,
      funnelId: params.funnelId,
      campaignId,
      funnelPublished,
      campaignPublished,
      funnelUrl,
      landingUrl,
    },
  });

  return {
    result: {
      funnelPublished,
      campaignPublished,
      funnelUrl,
      landingUrl,
      campaignId,
      messages,
      warnings,
    },
    error: warnings.length > 0 && !funnelUrl && !campaignId ? warnings.join(" ") : null,
  };
}

import { recordSystemLog } from "@/lib/logs/record";
import { FunnelPagesRepository } from "@/lib/supabase/repositories/funnel-pages.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import type { MasterFlow } from "@/types/database";
import { FUNNEL_PUBLISH_ORDER } from "@/utils/funnel-pages";
import { readMasterFlowMetadata } from "@/utils/master-flow";
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
  const campaignId = flow.campaign_id ?? meta.campaign_id ?? null;
  const excellenceScore = meta.excellence_score ?? null;

  if (ctx && flow.product_id && !checkoutUrl) {
    const { getCheckoutUrl } = await import("./checkout-engine.service");
    const { checkoutUrl: resolved } = await getCheckoutUrl(flow.product_id);
    checkoutUrl = resolved ?? checkoutUrl;
  }

  if (ctx && flow.funnel_id && (!funnelUrl || !landingUrl)) {
    const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
    const pagesRepo = new FunnelPagesRepository(ctx.supabase, ctx.userId);
    const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);

    const { data: funnel } = await funnelsRepo.findById(flow.funnel_id);
    funnelUrl = funnelUrl ?? readFunnelPrimaryUrl(funnel?.metadata ?? null);

    const { data: pages } = await pagesRepo.findByFunnelId(flow.funnel_id);
    const page = pages?.[0];
    if (page?.landing_page_id) {
      const { data: landing } = await landingRepo.findById(page.landing_page_id);
      landingUrl =
        landingUrl ?? landing?.published_url ?? landing?.preview_url ?? funnelUrl ?? null;
    }
    funnelUrl = funnelUrl ?? landingUrl;
  }

  const certification = evaluateReadyToSellCertification({
    checkout_url: checkoutUrl,
    funnel_url: funnelUrl,
    landing_url: landingUrl,
    campaign_id: campaignId,
    excellence_score: excellenceScore,
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
  return {
    certification,
    status: certification.ready ? "ready_to_sell" : "completed",
  };
}

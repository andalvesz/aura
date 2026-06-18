import type { MasterFlowMetadata } from "@/utils/master-flow";

export const READY_TO_SELL_EXCELLENCE_MIN = 85;

export type CheckoutCompletionResult = {
  checkout_created: boolean;
  checkout_url_valid: boolean;
  checkout_url_saved: boolean;
  checkout_injected: boolean;
  landing_cta_valid: boolean;
  ready: boolean;
  gaps: string[];
};

export function validateCheckoutUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateLandingCta(html: string | null | undefined, checkoutUrl: string | null): boolean {
  if (!html?.trim() || !checkoutUrl?.trim()) return false;
  return html.includes(checkoutUrl.trim());
}

export function evaluateCheckoutCompletion(params: {
  checkoutUrl: string | null;
  landingHtml?: string | null;
  updatedLandings?: number;
  updatedFunnels?: number;
}): CheckoutCompletionResult {
  const gaps: string[] = [];
  const checkout_created = Boolean(params.checkoutUrl);
  const checkout_url_valid = validateCheckoutUrl(params.checkoutUrl);
  const checkout_url_saved = checkout_url_valid;
  const checkout_injected = (params.updatedLandings ?? 0) > 0 || (params.updatedFunnels ?? 0) > 0;
  const landing_cta_valid = validateLandingCta(params.landingHtml ?? null, params.checkoutUrl);

  if (!checkout_created) gaps.push("checkout não criado");
  if (!checkout_url_valid) gaps.push("checkout_url inválida");
  if (!checkout_url_saved) gaps.push("checkout_url não salva");
  if (!checkout_injected) gaps.push("checkout_url não injetada no funil/landing");
  if (!landing_cta_valid && params.landingHtml) gaps.push("landing CTA não aponta para checkout");

  const ready =
    checkout_url_valid &&
    checkout_url_saved &&
    (checkout_injected || landing_cta_valid);

  return {
    checkout_created,
    checkout_url_valid,
    checkout_url_saved,
    checkout_injected,
    landing_cta_valid,
    ready,
    gaps,
  };
}

export type ReadyToSellRequirements = {
  checkout_url: string | null;
  funnel_url: string | null;
  landing_url: string | null;
  campaign_id: string | null;
  excellence_score: number | null;
  product_quality_score?: number | null;
  landing_quality_score?: number | null;
  campaign_quality_score?: number | null;
  creative_asset_delivered?: boolean;
  landing_html?: string | null;
  explicit_publish_approval?: boolean;
  certification_gaps?: string[] | null;
};

export type ReadyToSellCertification = {
  ready: boolean;
  commercial_status: "ready_to_sell" | "incomplete";
  requirements: ReadyToSellRequirements;
  gaps: string[];
};

export function evaluateReadyToSellCertification(
  requirements: ReadyToSellRequirements
): ReadyToSellCertification {
  const gaps: string[] = [];

  if (!validateCheckoutUrl(requirements.checkout_url)) {
    gaps.push("checkout_url ausente ou inválida");
  }
  if (!requirements.funnel_url?.trim()) gaps.push("funnel_url ausente");
  if (!requirements.landing_url?.trim()) gaps.push("landing_url ausente");
  if (!requirements.campaign_id?.trim()) gaps.push("campaign_id ausente");
  if (
    requirements.excellence_score == null ||
    requirements.excellence_score < READY_TO_SELL_EXCELLENCE_MIN
  ) {
    gaps.push(`excellence_score < ${READY_TO_SELL_EXCELLENCE_MIN}`);
  }
  if (
    requirements.product_quality_score == null ||
    requirements.product_quality_score < READY_TO_SELL_EXCELLENCE_MIN
  ) {
    gaps.push(`product_quality_score < ${READY_TO_SELL_EXCELLENCE_MIN}`);
  }
  if (
    requirements.landing_quality_score == null ||
    requirements.landing_quality_score < READY_TO_SELL_EXCELLENCE_MIN
  ) {
    gaps.push(`landing_quality_score < ${READY_TO_SELL_EXCELLENCE_MIN}`);
  }
  if (
    requirements.campaign_quality_score == null ||
    requirements.campaign_quality_score < READY_TO_SELL_EXCELLENCE_MIN
  ) {
    gaps.push(`campaign_quality_score < ${READY_TO_SELL_EXCELLENCE_MIN}`);
  }
  if (!requirements.creative_asset_delivered) {
    gaps.push("creative_generated_asset real não entregue");
  }
  if (!validateLandingCta(requirements.landing_html, requirements.checkout_url)) {
    gaps.push("landing CTA não aponta para checkout_url");
  }
  if (requirements.explicit_publish_approval === false) {
    gaps.push("aprovação explícita de publicação pendente");
  }
  for (const gap of requirements.certification_gaps ?? []) {
    if (gap.trim()) gaps.push(gap.trim());
  }

  const ready = gaps.length === 0;

  return {
    ready,
    commercial_status: ready ? "ready_to_sell" : "incomplete",
    requirements,
    gaps,
  };
}

export function certificationFromMetadata(meta: MasterFlowMetadata): ReadyToSellCertification {
  return evaluateReadyToSellCertification({
    checkout_url: meta.checkout_url ?? null,
    funnel_url: meta.funnel_url ?? null,
    landing_url: meta.landing_url ?? null,
    campaign_id: meta.campaign_id ?? null,
    excellence_score: meta.excellence_score ?? null,
  });
}

export function isReadyToSellStatus(status: string): boolean {
  return status === "ready_to_sell";
}

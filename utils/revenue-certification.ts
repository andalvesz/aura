import type { MasterFlowMetadata } from "@/utils/master-flow";

export const READY_TO_SELL_EXCELLENCE_MIN = 85;

export type ReadyToSellRequirements = {
  checkout_url: string | null;
  funnel_url: string | null;
  landing_url: string | null;
  campaign_id: string | null;
  excellence_score: number | null;
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

  if (!requirements.checkout_url?.trim()) gaps.push("checkout_url ausente");
  if (!requirements.funnel_url?.trim()) gaps.push("funnel_url ausente");
  if (!requirements.landing_url?.trim()) gaps.push("landing_url ausente");
  if (!requirements.campaign_id?.trim()) gaps.push("campaign_id ausente");
  if (
    requirements.excellence_score == null ||
    requirements.excellence_score < READY_TO_SELL_EXCELLENCE_MIN
  ) {
    gaps.push(`excellence_score < ${READY_TO_SELL_EXCELLENCE_MIN}`);
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

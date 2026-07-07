import type { MasterFlowMetadata } from "@/utils/master-flow";

export const COMMERCIAL_SCORE_MIN_READY = 90;
export const SALES_ASSET_SCORE_READY = 70;

export type SalesPackageAsset = {
  id: string | null;
  url?: string | null;
  ready: boolean;
  score: number;
};

export type SalesPackage = {
  offer: SalesPackageAsset;
  landing: SalesPackageAsset;
  copy: SalesPackageAsset;
  creativePackage: SalesPackageAsset;
  checkout: SalesPackageAsset;
  product: SalesPackageAsset;
  commercialScore: number;
  readyToSell: boolean;
  pendingItems: string[];
};

export type CommercialScoreBreakdown = {
  produto: number;
  oferta: number;
  landing: number;
  copy: number;
  criativos: number;
  checkout: number;
};

export type SalesStepKey =
  | "offer_engine"
  | "landing_factory"
  | "copylab"
  | "creative_director"
  | "checkout_engine"
  | "commercial_excellence";

export type SalesStepResult = {
  step: SalesStepKey;
  success: boolean;
  score: number;
  pending?: string;
  offerId?: string | null;
  landingId?: string | null;
  landingUrl?: string | null;
  copylabId?: string | null;
  creativeAssetId?: string | null;
  operationId?: string | null;
  checkoutId?: string | null;
  checkoutUrl?: string | null;
  commercialScore?: number;
  excellenceScore?: number;
};

export function computeCommercialScore(breakdown: CommercialScoreBreakdown): number {
  const values = [
    breakdown.produto,
    breakdown.oferta,
    breakdown.landing,
    breakdown.copy,
    breakdown.criativos,
    breakdown.checkout,
  ];
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

export function scoreAssetReady(present: boolean, qualityScore?: number | null): number {
  if (!present) return 0;
  if (qualityScore != null && Number.isFinite(qualityScore)) {
    return Math.min(100, Math.max(SALES_ASSET_SCORE_READY, qualityScore));
  }
  return SALES_ASSET_SCORE_READY;
}

export function buildCommercialBreakdown(input: {
  meta: MasterFlowMetadata;
  offerReady: boolean;
  landingReady: boolean;
  copyReady: boolean;
  creativeReady: boolean;
  checkoutReady: boolean;
  excellenceScore?: number | null;
}): CommercialScoreBreakdown {
  const productScore =
    input.meta.product_quality_score ??
    input.meta.excellence_score ??
    (input.meta.factory_id ? SALES_ASSET_SCORE_READY : 0);

  const excellence = input.excellenceScore ?? input.meta.commercial_excellence_score ?? null;

  return {
    produto: scoreAssetReady(Boolean(input.meta.factory_id), productScore),
    oferta: scoreAssetReady(input.offerReady, excellence),
    landing: scoreAssetReady(input.landingReady, excellence),
    copy: scoreAssetReady(input.copyReady, excellence),
    criativos: scoreAssetReady(input.creativeReady, excellence),
    checkout: scoreAssetReady(input.checkoutReady, excellence),
  };
}

export function buildSalesPackage(input: {
  meta: MasterFlowMetadata;
  productId?: string | null;
  offerId?: string | null;
  landingId?: string | null;
  landingUrl?: string | null;
  copylabId?: string | null;
  creativeAssetId?: string | null;
  checkoutId?: string | null;
  checkoutUrl?: string | null;
  commercialScore?: number | null;
  pendingItems?: string[];
}): SalesPackage {
  const breakdown = buildCommercialBreakdown({
    meta: input.meta,
    offerReady: Boolean(input.offerId ?? input.meta.offer_id),
    landingReady: Boolean(input.landingId ?? input.meta.landing_id),
    copyReady: Boolean(input.copylabId ?? input.meta.copylab_id),
    creativeReady: Boolean(input.creativeAssetId ?? input.meta.creative_asset_id),
    checkoutReady: Boolean(input.checkoutUrl ?? input.meta.checkout_url),
    excellenceScore: input.commercialScore ?? input.meta.commercial_excellence_score,
  });

  const commercialScore =
    input.commercialScore ??
    input.meta.commercial_score ??
    computeCommercialScore(breakdown);

  const offerId = input.offerId ?? input.meta.offer_id ?? null;
  const landingId = input.landingId ?? input.meta.landing_id ?? null;
  const copylabId = input.copylabId ?? input.meta.copylab_id ?? null;
  const creativeAssetId = input.creativeAssetId ?? input.meta.creative_asset_id ?? null;
  const checkoutUrl = input.checkoutUrl ?? input.meta.checkout_url ?? null;
  const productReady = Boolean(input.productId ?? input.meta.factory_id);

  const pendingItems = [...(input.pendingItems ?? input.meta.sales_pending_items ?? [])];

  const salesPackage: SalesPackage = {
    product: {
      id: input.productId ?? null,
      ready: productReady,
      score: breakdown.produto,
    },
    offer: {
      id: offerId,
      ready: Boolean(offerId),
      score: breakdown.oferta,
    },
    landing: {
      id: landingId,
      url: input.landingUrl ?? input.meta.landing_url ?? input.meta.funnel_url ?? null,
      ready: Boolean(landingId),
      score: breakdown.landing,
    },
    copy: {
      id: copylabId,
      ready: Boolean(copylabId),
      score: breakdown.copy,
    },
    creativePackage: {
      id: creativeAssetId,
      ready: Boolean(creativeAssetId),
      score: breakdown.criativos,
    },
    checkout: {
      id: input.checkoutId ?? input.meta.checkout_id ?? null,
      url: checkoutUrl,
      ready: Boolean(checkoutUrl?.trim()),
      score: breakdown.checkout,
    },
    commercialScore,
    readyToSell: false,
    pendingItems,
  };

  salesPackage.readyToSell = evaluateReadyToSell({
    meta: input.meta,
    salesPackage,
    commercialScore,
  });

  return salesPackage;
}

export function evaluateReadyToSell(input: {
  meta: MasterFlowMetadata;
  salesPackage: SalesPackage;
  commercialScore?: number | null;
}): boolean {
  const { meta, salesPackage } = input;
  const score = input.commercialScore ?? salesPackage.commercialScore;

  const productApproved =
    Boolean(meta.factory_id) &&
    ((meta.product_quality_score ?? 0) >= 85 ||
      meta.product_strategy_adherence?.aligned === true);
  const validationApproved = meta.validation_approved === true;
  const strategyApproved = Boolean(meta.selected_strategy ?? meta.product_build_brief);

  return (
    productApproved &&
    validationApproved &&
    strategyApproved &&
    salesPackage.offer.ready &&
    salesPackage.landing.ready &&
    salesPackage.copy.ready &&
    salesPackage.creativePackage.ready &&
    salesPackage.checkout.ready &&
    score >= COMMERCIAL_SCORE_MIN_READY
  );
}

export function applySalesStepFailure(
  salesPackage: SalesPackage,
  step: SalesStepKey,
  message: string
): SalesPackage {
  return {
    ...salesPackage,
    readyToSell: false,
    pendingItems: [...salesPackage.pendingItems, `${stepLabel(step)}: ${message}`],
  };
}

function stepLabel(step: SalesStepKey): string {
  const labels: Record<SalesStepKey, string> = {
    offer_engine: "Oferta",
    landing_factory: "Landing",
    copylab: "Copy",
    creative_director: "Criativos",
    checkout_engine: "Checkout",
    commercial_excellence: "Excelência comercial",
  };
  return labels[step];
}

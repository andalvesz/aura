import type { Offer, OfferType, Json } from "@/types/database";

export const OFFER_ENGINE_SAFE_MODE = {
  active: true,
  message:
    "Offer Engine Pro gera ofertas em rascunho — revise preços e take rates antes de ativar.",
};

export type GeneratedOfferPayload = {
  offer_type: OfferType;
  title: string;
  description: string;
  price: number;
  take_rate_hint: number;
  bullets?: string[];
  cta?: string;
  rationale: string;
  stack_order?: number;
};

export type OfferEngineIntake = {
  product_id: string;
  funnel_id?: string | null;
  factory_id?: string | null;
  front_price?: number;
  currency?: string;
};

export type OfferStackStrategy = {
  upsellCount: number;
  includeOrderBump: boolean;
  includeDownsell: boolean;
  includeVip: boolean;
  includeContinuity: boolean;
  label: string;
};

export type OfferRecommendation = {
  priority: "high" | "medium" | "low";
  title: string;
  summary: string;
  offerType?: OfferType;
};

export type OfferBestCard = {
  label: string;
  offerType: OfferType;
  price: number;
  takeRate: number;
  expectedRevenue: number;
  score: number;
  rationale: string | null;
};

export type OfferStackMetrics = {
  expectedAov: number;
  expectedAverageTicket: number;
  frontPrice: number;
  totalOffers: number;
  strategy: OfferStackStrategy;
};

export type OfferStackBundle = {
  product_id: string;
  funnel_id: string | null;
  offers: Offer[];
  metrics: OfferStackMetrics;
  recommendations: OfferRecommendation[];
};

export type OfferEngineDashboard = {
  expectedAov: number;
  expectedAverageTicket: number;
  expectedRevenueByFunnel: {
    funnelId: string;
    funnelName: string;
    revenue: number;
    offerCount: number;
  }[];
  bestOfferStructure: OfferBestCard | null;
  bestUpsell: OfferBestCard | null;
  bestDownsell: OfferBestCard | null;
  totalStacks: number;
  totalOffers: number;
};

const DEFAULT_TAKE_RATES: Record<OfferType, number> = {
  front_end: 1,
  order_bump: 0.32,
  upsell: 0.18,
  downsell: 0.22,
  vip_offer: 0.08,
  continuity: 0.15,
};

const SUBSCRIPTION_PATTERN =
  /assinatura|mensal|recorrente|continuidade|subscription|membros|clube|mensalidade/i;

export function isSubscriptionProduct(params: {
  formato?: string | null;
  nome?: string | null;
  promessa?: string | null;
  productType?: string | null;
}): boolean {
  const text = [
    params.formato,
    params.nome,
    params.promessa,
    params.productType,
  ]
    .filter(Boolean)
    .join(" ");
  return SUBSCRIPTION_PATTERN.test(text);
}

export function resolveOfferStackStrategy(
  frontPrice: number,
  isSubscription: boolean
): OfferStackStrategy {
  if (isSubscription) {
    return {
      upsellCount: 1,
      includeOrderBump: true,
      includeDownsell: false,
      includeVip: false,
      includeContinuity: true,
      label: "Assinatura — foco em continuidade + bump",
    };
  }
  if (frontPrice <= 97) {
    return {
      upsellCount: 3,
      includeOrderBump: true,
      includeDownsell: true,
      includeVip: true,
      includeContinuity: false,
      label: "Ticket baixo — maximizar upsells",
    };
  }
  if (frontPrice > 197) {
    return {
      upsellCount: 1,
      includeOrderBump: true,
      includeDownsell: true,
      includeVip: true,
      includeContinuity: false,
      label: "Ticket alto — funil enxuto",
    };
  }
  return {
    upsellCount: 2,
    includeOrderBump: true,
    includeDownsell: true,
    includeVip: true,
    includeContinuity: false,
    label: "Ticket médio — equilíbrio bump + upsells",
  };
}

export function readOfferTakeRate(offer: Offer): number {
  if (offer.expected_take_rate != null && Number.isFinite(Number(offer.expected_take_rate))) {
    const rate = Number(offer.expected_take_rate);
    return rate > 1 ? rate / 100 : rate;
  }
  if (offer.metadata && typeof offer.metadata === "object" && !Array.isArray(offer.metadata)) {
    const meta = offer.metadata as Record<string, unknown>;
    const hint = meta.take_rate_hint ?? meta.take_rate;
    if (typeof hint === "number" && Number.isFinite(hint)) {
      return hint > 1 ? hint / 100 : hint;
    }
  }
  return DEFAULT_TAKE_RATES[offer.offer_type] ?? 0.1;
}

export function calculateExpectedTakeRate(params: {
  offerType: OfferType;
  frontPrice: number;
  takeRateHint?: number | null;
  growthConversionRate?: number | null;
  marketScore?: number | null;
}): number {
  const base =
    params.takeRateHint != null && Number.isFinite(params.takeRateHint)
      ? params.takeRateHint > 1
        ? params.takeRateHint / 100
        : params.takeRateHint
      : DEFAULT_TAKE_RATES[params.offerType];

  let rate = base;
  if (params.offerType === "front_end") return 1;

  if (params.growthConversionRate != null && params.growthConversionRate > 0) {
    rate = (rate + Math.min(params.growthConversionRate * 2, 0.5)) / 2;
  }

  if (params.marketScore != null && params.marketScore >= 70) {
    rate *= 1.05;
  }

  if (params.frontPrice <= 97 && params.offerType === "upsell") {
    rate *= 1.08;
  }
  if (params.frontPrice > 197 && params.offerType === "upsell") {
    rate *= 0.85;
  }

  return Math.round(Math.min(Math.max(rate, 0.02), 0.95) * 10000) / 10000;
}

export function calculateExpectedAOV(offers: Offer[]): number {
  let aov = 0;
  for (const offer of offers) {
    const price = Number(offer.price ?? 0);
    const takeRate = readOfferTakeRate(offer);
    if (offer.offer_type === "front_end") {
      aov += price;
    } else {
      aov += price * takeRate;
    }
  }
  return Math.round(aov * 100) / 100;
}

export function calculateExpectedAverageTicket(offers: Offer[]): number {
  const paidOffers = offers.filter((o) => Number(o.price ?? 0) > 0);
  if (paidOffers.length === 0) return 0;
  const sum = paidOffers.reduce((acc, o) => acc + Number(o.price ?? 0), 0);
  return Math.round((sum / paidOffers.length) * 100) / 100;
}

export function computeOfferExpectedRevenue(offer: Offer): number {
  const price = Number(offer.price ?? 0);
  const takeRate = readOfferTakeRate(offer);
  if (offer.offer_type === "front_end") return price;
  return Math.round(price * takeRate * 100) / 100;
}

export function generateOfferRecommendations(
  offers: Offer[],
  strategy: OfferStackStrategy
): OfferRecommendation[] {
  const recommendations: OfferRecommendation[] = [];
  const aov = calculateExpectedAOV(offers);
  const upsells = offers.filter((o) => o.offer_type === "upsell");
  const bump = offers.find((o) => o.offer_type === "order_bump");
  const continuity = offers.find((o) => o.offer_type === "continuity");

  recommendations.push({
    priority: "high",
    title: "Estrutura recomendada",
    summary: strategy.label,
  });

  if (bump) {
    recommendations.push({
      priority: "high",
      title: "Order bump",
      summary: `${bump.title} — R$ ${Number(bump.price).toFixed(2)} · take ${Math.round(readOfferTakeRate(bump) * 100)}%`,
      offerType: "order_bump",
    });
  }

  if (upsells.length > 0) {
    const best = upsells.reduce((acc, item) =>
      computeOfferExpectedRevenue(item) > computeOfferExpectedRevenue(acc) ? item : acc
    );
    recommendations.push({
      priority: "high",
      title: "Melhor upsell",
      summary: `${best.title} — receita esperada R$ ${computeOfferExpectedRevenue(best).toFixed(2)}`,
      offerType: "upsell",
    });
  }

  const downsell = offers.find((o) => o.offer_type === "downsell");
  if (downsell) {
    recommendations.push({
      priority: "medium",
      title: "Downsell de recuperação",
      summary: `${downsell.title} — capture quem recusou upsell`,
      offerType: "downsell",
    });
  }

  if (continuity) {
    recommendations.push({
      priority: "high",
      title: "Continuidade",
      summary: `${continuity.title} — recorrência sugerida para assinatura`,
      offerType: "continuity",
    });
  }

  recommendations.push({
    priority: "medium",
    title: "AOV projetado",
    summary: `Ticket combinado esperado: R$ ${aov.toFixed(2)}`,
  });

  return recommendations;
}

function toBestCard(offer: Offer): OfferBestCard {
  const takeRate = readOfferTakeRate(offer);
  const expectedRevenue = computeOfferExpectedRevenue(offer);
  const meta =
    offer.metadata && typeof offer.metadata === "object" && !Array.isArray(offer.metadata)
      ? (offer.metadata as Record<string, unknown>)
      : {};
  return {
    label: offer.title,
    offerType: offer.offer_type,
    price: Number(offer.price ?? 0),
    takeRate,
    expectedRevenue,
    score: Math.round(expectedRevenue * takeRate * 100),
    rationale: typeof meta.rationale === "string" ? meta.rationale : null,
  };
}

export function computeOfferEngineDashboard(params: {
  offers: Offer[];
  funnelNames: Record<string, string>;
}): OfferEngineDashboard {
  const { offers, funnelNames } = params;
  const stacks = new Set(
    offers.map((o) => `${o.product_id ?? "none"}:${o.funnel_id ?? "none"}`)
  );

  const expectedAov =
    offers.length > 0 ? calculateExpectedAOV(offers) : 0;
  const expectedAverageTicket =
    offers.length > 0 ? calculateExpectedAverageTicket(offers) : 0;

  const funnelMap = new Map<string, { revenue: number; count: number }>();
  for (const offer of offers) {
    if (!offer.funnel_id) continue;
    const current = funnelMap.get(offer.funnel_id) ?? { revenue: 0, count: 0 };
    current.revenue += computeOfferExpectedRevenue(offer);
    current.count += 1;
    funnelMap.set(offer.funnel_id, current);
  }

  const expectedRevenueByFunnel = [...funnelMap.entries()]
    .map(([funnelId, data]) => ({
      funnelId,
      funnelName: funnelNames[funnelId] ?? "Funil",
      revenue: Math.round(data.revenue * 100) / 100,
      offerCount: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const upsells = offers.filter((o) => o.offer_type === "upsell");
  const downsells = offers.filter((o) => o.offer_type === "downsell");
  const monetizationOffers = offers.filter((o) => o.offer_type !== "front_end");

  const bestUpsell =
    upsells.length > 0
      ? upsells
          .map(toBestCard)
          .reduce((best, item) => (item.expectedRevenue > best.expectedRevenue ? item : best))
      : null;

  const bestDownsell =
    downsells.length > 0
      ? downsells
          .map(toBestCard)
          .reduce((best, item) => (item.expectedRevenue > best.expectedRevenue ? item : best))
      : null;

  const bestOfferStructure =
    monetizationOffers.length > 0
      ? monetizationOffers
          .map(toBestCard)
          .reduce((best, item) => (item.score > best.score ? item : best))
      : null;

  return {
    expectedAov,
    expectedAverageTicket,
    expectedRevenueByFunnel,
    bestOfferStructure,
    bestUpsell,
    bestDownsell,
    totalStacks: stacks.size,
    totalOffers: offers.length,
  };
}

export function buildOfferEngineAuraContext(bundle: OfferStackBundle): string {
  const lines = [
    `Produto: ${bundle.product_id}`,
    `Estratégia: ${bundle.metrics.strategy.label}`,
    `AOV esperado: R$ ${bundle.metrics.expectedAov.toFixed(2)}`,
    `Ticket médio: R$ ${bundle.metrics.expectedAverageTicket.toFixed(2)}`,
    ...bundle.offers.map(
      (o) =>
        `- ${o.offer_type}: ${o.title} · R$ ${Number(o.price).toFixed(2)} · take ${Math.round(readOfferTakeRate(o) * 100)}%`
    ),
    ...bundle.recommendations.slice(0, 3).map((r) => `→ ${r.title}: ${r.summary}`),
  ];
  return lines.join("\n");
}

export function mergeOfferMetadata(
  current: Json,
  patch: Record<string, unknown>
): Json {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Json;
}

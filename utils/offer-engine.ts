import type { Offer, OfferType, Json } from "@/types/database";
import type { UnifiedDecisionEngineResult } from "@/utils/aura-decision-engine";

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
  country?: string;
};

export type OfferStackStrategy = {
  upsellCount: number;
  includeOrderBump: boolean;
  includeDownsell: boolean;
  includeVip: boolean;
  includeContinuity: boolean;
  label: string;
};

export type OfferStructureDecisionSource =
  | "ticket_rules"
  | "decision_engine"
  | "growth_brain"
  | "revenue_ai"
  | "blended";

export type OfferStackStrategyDecision = OfferStackStrategy & {
  decisionSource: OfferStructureDecisionSource;
  confidence: number;
  reasons: string[];
};

export type OfferStructureSignals = {
  frontPrice: number;
  isSubscription: boolean;
  niche: string;
  country: string | null;
  currency: string;
  growthConversionRate: number | null;
  growthNicheScore: number | null;
  growthCountryScore: number | null;
  growthAvgRoas: number | null;
  revenueConversionRate: number | null;
  revenueRoas: number | null;
  marketScore: number | null;
};

const COUNTRY_CURRENCY: Record<string, string> = {
  BR: "BRL",
  US: "USD",
  UK: "GBP",
  GB: "GBP",
  CA: "CAD",
  AU: "AUD",
  DE: "EUR",
  FR: "EUR",
  PT: "EUR",
  ES: "EUR",
  IT: "EUR",
  MX: "MXN",
  AR: "ARS",
  CO: "COP",
  CL: "CLP",
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
  strategyDecision?: OfferStackStrategyDecision;
  currency: string;
  country: string | null;
  niche: string;
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

export function resolveCountryAndCurrency(params: {
  country?: string | null;
  currency?: string | null;
  productCountry?: string | null;
  productCurrency?: string | null;
}): { country: string | null; currency: string } {
  const country = params.country ?? params.productCountry ?? null;
  const normalizedCountry = country?.trim().toUpperCase() ?? null;
  const currency =
    params.currency?.trim().toUpperCase() ??
    (normalizedCountry ? COUNTRY_CURRENCY[normalizedCountry] : null) ??
    params.productCurrency?.trim().toUpperCase() ??
    "BRL";
  return { country: normalizedCountry, currency };
}

export function formatOfferPrice(price: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  try {
    return new Intl.NumberFormat(code === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${code} ${price.toFixed(2)}`;
  }
}

export function normalizeNicheLabel(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function nicheMatchesSignal(
  signalNiche: string,
  candidate: string | null | undefined
): boolean {
  const a = normalizeNicheLabel(signalNiche);
  const b = normalizeNicheLabel(candidate);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

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

function buildStrategyLabel(params: {
  upsellCount: number;
  includeOrderBump: boolean;
  includeDownsell: boolean;
  includeVip: boolean;
  includeContinuity: boolean;
  niche: string;
  country: string | null;
  source: OfferStructureDecisionSource;
}): string {
  const parts: string[] = [];
  if (params.includeOrderBump) parts.push("bump");
  if (params.upsellCount > 0) parts.push(`${params.upsellCount} upsell${params.upsellCount > 1 ? "s" : ""}`);
  if (params.includeDownsell) parts.push("downsell");
  if (params.includeVip) parts.push("VIP");
  if (params.includeContinuity) parts.push("continuidade");

  const market = params.country ? params.country : "mercado geral";
  const structure = parts.length > 0 ? parts.join(" + ") : "front-end";
  return `${structure} · ${params.niche} · ${market} (${params.source})`;
}

export function selectBestOfferStructure(
  signals: OfferStructureSignals,
  decisions: UnifiedDecisionEngineResult | null
): OfferStackStrategyDecision {
  const base = resolveOfferStackStrategy(signals.frontPrice, signals.isSubscription);
  const reasons: string[] = [`Ticket ${formatOfferPrice(signals.frontPrice, signals.currency)}: ${base.label}`];

  let upsellCount = base.upsellCount;
  let includeOrderBump = base.includeOrderBump;
  let includeDownsell = base.includeDownsell;
  let includeVip = base.includeVip;
  let includeContinuity = base.includeContinuity;

  let confidence = 35;
  let decisionSource: OfferStructureDecisionSource = "ticket_rules";
  const sourceHits = new Set<OfferStructureDecisionSource>();

  if (signals.growthConversionRate != null && signals.growthConversionRate > 0.03) {
    upsellCount = Math.min(3, upsellCount + 1);
    reasons.push(
      `Growth Brain: conversão ${(signals.growthConversionRate * 100).toFixed(1)}% — stack mais agressiva`
    );
    confidence += 14;
    sourceHits.add("growth_brain");
  } else if (signals.growthConversionRate != null && signals.growthConversionRate < 0.015) {
    includeDownsell = true;
    upsellCount = Math.max(1, upsellCount - 1);
    reasons.push("Growth Brain: conversão baixa — priorizar downsell");
    confidence += 10;
    sourceHits.add("growth_brain");
  }

  if (signals.growthNicheScore != null && signals.growthNicheScore >= 55) {
    upsellCount = Math.min(3, upsellCount + 1);
    includeOrderBump = true;
    reasons.push(`Growth Brain: nicho "${signals.niche}" com histórico positivo`);
    confidence += 12;
    sourceHits.add("growth_brain");
  }

  if (signals.growthCountryScore != null && signals.growthCountryScore >= 50) {
    confidence += 8;
    reasons.push(
      `Growth Brain: país ${signals.country ?? "—"} validado (score ${Math.round(signals.growthCountryScore)})`
    );
    sourceHits.add("growth_brain");
  }

  if (signals.growthAvgRoas != null && signals.growthAvgRoas >= 1.8) {
    upsellCount = Math.min(3, upsellCount + 1);
    includeVip = true;
    reasons.push(`Growth Brain: ROAS médio ${signals.growthAvgRoas.toFixed(1)}x`);
    confidence += 10;
    sourceHits.add("growth_brain");
  }

  if (signals.revenueRoas != null && signals.revenueRoas >= 2) {
    upsellCount = Math.min(3, upsellCount + 1);
    includeVip = true;
    reasons.push(`Revenue AI: ROAS ${signals.revenueRoas.toFixed(1)}x — maximizar monetização`);
    confidence += 15;
    sourceHits.add("revenue_ai");
  } else if (signals.revenueRoas != null && signals.revenueRoas < 1) {
    upsellCount = Math.max(1, upsellCount - 1);
    includeDownsell = true;
    reasons.push("Revenue AI: ROAS baixo — funil conservador com downsell");
    confidence += 10;
    sourceHits.add("revenue_ai");
  }

  if (signals.revenueConversionRate != null && signals.revenueConversionRate > 0) {
    reasons.push(
      `Revenue AI: conversão ${(signals.revenueConversionRate * 100).toFixed(1)}%`
    );
    confidence += 6;
    sourceHits.add("revenue_ai");
  }

  const country = signals.country;
  if (country && ["US", "UK", "GB", "CA", "AU", "DE", "FR", "EU"].includes(country)) {
    if (signals.frontPrice > 97) {
      upsellCount = Math.max(1, upsellCount - 1);
      includeVip = true;
    }
    reasons.push(`País ${country}: mercado premium (${signals.currency})`);
    confidence += 8;
  } else if (country === "BR" || !country) {
    includeOrderBump = true;
    if (signals.frontPrice <= 97) {
      upsellCount = Math.max(upsellCount, 2);
    }
    reasons.push("Mercado BR/ticket baixo: bumps e upsells complementares");
  }

  const nicheLower = signals.niche.toLowerCase();
  if (/saúde|saude|fitness|emagrecimento|wellness|nutri/.test(nicheLower)) {
    includeOrderBump = true;
    if (signals.isSubscription) includeContinuity = true;
    reasons.push("Nicho saúde/fitness: bump e continuidade");
  }
  if (/finanças|financas|investimento|money|crypto|renda/.test(nicheLower)) {
    includeVip = true;
    if (signals.frontPrice > 97) upsellCount = Math.min(upsellCount, 2);
    reasons.push("Nicho finanças: upsells premium + VIP");
  }

  if (signals.marketScore != null && signals.marketScore >= 75) {
    upsellCount = Math.min(3, upsellCount + 1);
    reasons.push(`Market Hunter: demanda alta (score ${signals.marketScore})`);
    confidence += 8;
  }

  if (decisions) {
    confidence += Math.min(18, decisions.confidence / 4);

    if (decisions.bestOffer && decisions.bestOffer.score >= 55) {
      if (decisions.bestOffer.source === "revenue_ai" || decisions.bestOffer.score >= 70) {
        upsellCount = Math.min(3, upsellCount + 1);
      }
      reasons.push(`Decision Engine: ${decisions.bestOffer.label} — ${decisions.bestOffer.reason}`);
      sourceHits.add("decision_engine");
    }

    if (decisions.bestCountry && country) {
      const bestCountry = decisions.bestCountry.label.toUpperCase();
      if (
        (bestCountry.includes(country) || country.includes(bestCountry)) &&
        decisions.bestCountry.score >= 50
      ) {
        confidence += 10;
        reasons.push(`Decision Engine: país ${decisions.bestCountry.label} recomendado`);
        sourceHits.add("decision_engine");
      }
    }

    if (decisions.bestProduct && decisions.bestProduct.score >= 60) {
      reasons.push(`Decision Engine: produto ${decisions.bestProduct.label}`);
      sourceHits.add("decision_engine");
    }
  }

  upsellCount = Math.max(0, Math.min(3, upsellCount));

  if (sourceHits.size === 1) {
    decisionSource = [...sourceHits][0];
  } else if (sourceHits.size > 1) {
    decisionSource = "blended";
  }

  return {
    upsellCount,
    includeOrderBump,
    includeDownsell,
    includeVip,
    includeContinuity,
    label: buildStrategyLabel({
      upsellCount,
      includeOrderBump,
      includeDownsell,
      includeVip,
      includeContinuity,
      niche: signals.niche,
      country,
      source: decisionSource,
    }),
    decisionSource,
    confidence: Math.min(100, Math.round(confidence)),
    reasons,
  };
}

export function readStoredStrategyDecision(offer: Offer): OfferStackStrategyDecision | null {
  if (!offer.metadata || typeof offer.metadata !== "object" || Array.isArray(offer.metadata)) {
    return null;
  }
  const meta = offer.metadata as Record<string, unknown>;
  const stored = meta.strategy_decision;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const decision = stored as Record<string, unknown>;
  if (typeof decision.label !== "string") return null;
  return {
    upsellCount: Number(decision.upsellCount ?? 0),
    includeOrderBump: Boolean(decision.includeOrderBump),
    includeDownsell: Boolean(decision.includeDownsell),
    includeVip: Boolean(decision.includeVip),
    includeContinuity: Boolean(decision.includeContinuity),
    label: decision.label,
    decisionSource:
      (decision.decisionSource as OfferStructureDecisionSource | undefined) ?? "blended",
    confidence: Number(decision.confidence ?? 0),
    reasons: Array.isArray(decision.reasons)
      ? decision.reasons.filter((item): item is string => typeof item === "string")
      : [],
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
  revenueConversionRate?: number | null;
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

  if (params.revenueConversionRate != null && params.revenueConversionRate > 0) {
    rate = (rate + Math.min(params.revenueConversionRate * 1.5, 0.4)) / 2;
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
  strategy: OfferStackStrategy,
  currency = "BRL"
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
      summary: `${bump.title} — ${formatOfferPrice(Number(bump.price), currency)} · take ${Math.round(readOfferTakeRate(bump) * 100)}%`,
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
      summary: `${best.title} — receita esperada ${formatOfferPrice(computeOfferExpectedRevenue(best), currency)}`,
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
    summary: `Ticket combinado esperado: ${formatOfferPrice(aov, currency)}`,
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
  const stackGroups = new Map<string, Offer[]>();
  for (const offer of offers) {
    const key = `${offer.product_id ?? "none"}:${offer.funnel_id ?? "none"}`;
    const group = stackGroups.get(key) ?? [];
    group.push(offer);
    stackGroups.set(key, group);
  }

  const stackAovs = [...stackGroups.values()].map((group) => calculateExpectedAOV(group));
  const stackTickets = [...stackGroups.values()].map((group) =>
    calculateExpectedAverageTicket(group)
  );

  const expectedAov =
    stackAovs.length > 0
      ? Math.round((stackAovs.reduce((acc, value) => acc + value, 0) / stackAovs.length) * 100) /
        100
      : 0;
  const expectedAverageTicket =
    stackTickets.length > 0
      ? Math.round(
          (stackTickets.reduce((acc, value) => acc + value, 0) / stackTickets.length) * 100
        ) / 100
      : 0;

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
    totalStacks: stackGroups.size,
    totalOffers: offers.length,
  };
}

export function buildOfferEngineAuraContext(bundle: OfferStackBundle): string {
  const currency = bundle.metrics.currency ?? "BRL";
  const lines = [
    `Produto: ${bundle.product_id}`,
    `Nicho: ${bundle.metrics.niche}`,
    `País: ${bundle.metrics.country ?? "—"} · Moeda: ${currency}`,
    `Estratégia: ${bundle.metrics.strategy.label}`,
    bundle.metrics.strategyDecision
      ? `Decision Engine: ${bundle.metrics.strategyDecision.decisionSource} (${bundle.metrics.strategyDecision.confidence}% confiança)`
      : null,
    `AOV esperado: ${formatOfferPrice(bundle.metrics.expectedAov, currency)}`,
    `Ticket médio: ${formatOfferPrice(bundle.metrics.expectedAverageTicket, currency)}`,
    ...bundle.offers.map(
      (o) =>
        `- ${o.offer_type}: ${o.title} · ${formatOfferPrice(Number(o.price), currency)} · take ${Math.round(readOfferTakeRate(o) * 100)}%`
    ),
    ...bundle.recommendations.slice(0, 3).map((r) => `→ ${r.title}: ${r.summary}`),
  ].filter(Boolean);
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

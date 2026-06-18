import assert from "node:assert/strict";
import test from "node:test";
import type { UnifiedDecisionEngineResult } from "@/utils/aura-decision-engine";
import {
  calculateExpectedTakeRate,
  computeOfferEngineDashboard,
  resolveCountryAndCurrency,
  resolveOfferStackStrategy,
  selectBestOfferStructure,
  type OfferStructureSignals,
} from "@/utils/offer-engine";
import type { Offer } from "@/types/database";

const baseSignals: OfferStructureSignals = {
  frontPrice: 97,
  isSubscription: false,
  niche: "emagrecimento",
  country: "BR",
  currency: "BRL",
  growthConversionRate: null,
  growthNicheScore: null,
  growthCountryScore: null,
  growthAvgRoas: null,
  revenueConversionRate: null,
  revenueRoas: null,
  marketScore: null,
};

test("resolveCountryAndCurrency maps BR to BRL", () => {
  const result = resolveCountryAndCurrency({
    productCountry: "BR",
    productCurrency: null,
  });
  assert.equal(result.country, "BR");
  assert.equal(result.currency, "BRL");
});

test("resolveOfferStackStrategy maximizes upsells for low ticket", () => {
  const strategy = resolveOfferStackStrategy(47, false);
  assert.equal(strategy.upsellCount, 3);
  assert.equal(strategy.includeOrderBump, true);
  assert.equal(strategy.includeDownsell, true);
});

test("selectBestOfferStructure uses Revenue AI ROAS to expand stack", () => {
  const strategy = selectBestOfferStructure(
    {
      ...baseSignals,
      revenueRoas: 2.5,
      revenueConversionRate: 0.04,
    },
    null
  );

  assert.ok(strategy.upsellCount >= 2);
  assert.equal(strategy.includeVip, true);
  assert.equal(strategy.decisionSource, "revenue_ai");
  assert.ok(strategy.reasons.some((reason) => reason.includes("Revenue AI")));
});

test("selectBestOfferStructure blends Decision Engine signals", () => {
  const decisions: UnifiedDecisionEngineResult = {
    bestProduct: {
      label: "Produto X",
      score: 72,
      source: "revenue_ai",
      reason: "Melhor ROAS",
      entityId: "prod-1",
      metadata: {},
    },
    bestCountry: {
      label: "BR",
      score: 65,
      source: "growth_brain",
      reason: "Melhor país",
      entityId: null,
      metadata: {},
    },
    bestLanguage: null,
    bestOffer: {
      label: "Stack agressiva",
      score: 78,
      source: "revenue_ai",
      reason: "ROAS validado",
      entityId: null,
      metadata: {},
    },
    bestCreative: null,
    bestLanding: null,
    bestCampaign: null,
    sourcesUsed: ["growth_brain", "revenue_ai"],
    confidence: 68,
  };

  const strategy = selectBestOfferStructure(baseSignals, decisions);
  assert.ok(strategy.upsellCount >= 3);
  assert.ok(strategy.reasons.some((reason) => reason.includes("Decision Engine")));
  assert.ok(strategy.confidence >= 50);
});

test("calculateExpectedTakeRate blends revenue conversion", () => {
  const withoutRevenue = calculateExpectedTakeRate({
    offerType: "upsell",
    frontPrice: 97,
    growthConversionRate: 0.02,
  });
  const withRevenue = calculateExpectedTakeRate({
    offerType: "upsell",
    frontPrice: 97,
    growthConversionRate: 0.02,
    revenueConversionRate: 0.08,
  });

  assert.ok(withRevenue > withoutRevenue);
});

test("computeOfferEngineDashboard averages AOV per stack", () => {
  const offers: Offer[] = [
    {
      id: "1",
      user_id: "u1",
      funnel_id: "f1",
      product_id: "p1",
      offer_type: "front_end",
      title: "Front 1",
      description: "",
      price: 100,
      currency: "BRL",
      expected_take_rate: 1,
      expected_revenue: 100,
      status: "ready",
      metadata: {},
      created_at: "",
      updated_at: "",
    },
    {
      id: "2",
      user_id: "u1",
      funnel_id: "f1",
      product_id: "p1",
      offer_type: "order_bump",
      title: "Bump 1",
      description: "",
      price: 30,
      currency: "BRL",
      expected_take_rate: 0.3,
      expected_revenue: 9,
      status: "suggested",
      metadata: {},
      created_at: "",
      updated_at: "",
    },
    {
      id: "3",
      user_id: "u1",
      funnel_id: "f2",
      product_id: "p2",
      offer_type: "front_end",
      title: "Front 2",
      description: "",
      price: 200,
      currency: "BRL",
      expected_take_rate: 1,
      expected_revenue: 200,
      status: "ready",
      metadata: {},
      created_at: "",
      updated_at: "",
    },
  ];

  const dashboard = computeOfferEngineDashboard({ offers, funnelNames: {} });
  assert.equal(dashboard.totalStacks, 2);
  assert.equal(dashboard.expectedAov, 154.5);
});

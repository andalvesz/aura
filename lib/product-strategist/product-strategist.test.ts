import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import { validateOpportunity } from "@/lib/validation/validation-engine";
import {
  buildStrategyScores,
  computeRevenueScore,
  computeSpeedScore,
  computeStrategyTotalScore,
} from "@/lib/product-strategist/product-strategist-score";
import { runProductStrategist, strategizeProduct } from "@/lib/product-strategist/product-strategist";

const strongOpportunity: OpportunityRecommendation = {
  title: "Programa Elite de Excel — Excel",
  niche: "Excel",
  avatar: "Profissional administrativo",
  problem: "Perde horas em planilhas mal estruturadas",
  market: "Brasil",
  technology: "Excel",
  businessModel: "Curso",
  confidence: 85,
  recommendedProduct: "Curso de Excel",
  price: 297,
  opportunityScore: {
    demand: 88,
    competition: 82,
    ticket: 85,
    production: 90,
    launchSpeed: 88,
    scalability: 86,
    margin: 84,
    total: 87,
  },
  intentMatchScore: 85,
  estimatedProfit: 22000,
  investmentScore: 88,
  uniquenessScore: 75,
  reason: "Alta demanda com produção rápida.",
};

describe("product strategist score", () => {
  it("computes revenue score relative to target", () => {
    assert.ok(computeRevenueScore(22000, 20000) >= 85);
    assert.ok(computeRevenueScore(8000, 20000) < 60);
  });

  it("favors faster launch times in speed score", () => {
    assert.ok(computeSpeedScore(3) > computeSpeedScore(14));
  });

  it("computes total score from weighted dimensions", () => {
    const partial = {
      revenue: 80,
      execution: 75,
      scalability: 85,
      speed: 90,
      investment: 95,
    };
    const total = computeStrategyTotalScore(partial);
    assert.ok(total >= 80 && total <= 92);
  });
});

describe("product strategist engine", () => {
  it("generates between 3 and 5 strategies for approved opportunity", () => {
    const validation = validateOpportunity(strongOpportunity);
    assert.equal(validation.approved, true);

    const result = strategizeProduct(strongOpportunity, validation);

    assert.ok(result.strategies.length >= 3);
    assert.ok(result.strategies.length <= 5);
    assert.ok(result.recommendation);
    assert.ok(result.explanation.includes("Recomendo"));
  });

  it("assigns unique strategy letters A through E", () => {
    const validation = validateOpportunity(strongOpportunity);
    const result = strategizeProduct(strongOpportunity, validation);
    const ids = result.strategies.map((s) => s.id);

    assert.deepEqual(ids, ids.slice(0, result.strategies.length));
    assert.equal(ids[0], "A");
    if (result.strategies.length >= 2) assert.equal(ids[1], "B");
  });

  it("includes required financial fields on each strategy", () => {
    const validation = validateOpportunity(strongOpportunity);
    const result = strategizeProduct(strongOpportunity, validation);

    for (const strategy of result.strategies) {
      assert.ok(strategy.strategyType);
      assert.ok(strategy.strategyName);
      assert.ok(strategy.ticket > 0);
      assert.ok(strategy.estimatedRevenue > 0);
      assert.ok(strategy.estimatedCost >= 0);
      assert.ok(strategy.estimatedLaunchTime > 0);
      assert.ok(strategy.estimatedMargin > 0);
      assert.ok(strategy.estimatedROI > 0);
      assert.ok(strategy.scores.total >= 0 && strategy.scores.total <= 100);
      assert.ok(strategy.reason.length > 0);
    }
  });

  it("rejects unapproved validation", () => {
    const weak: OpportunityRecommendation = {
      ...strongOpportunity,
      niche: "Marketing Digital",
      opportunityScore: {
        demand: 40,
        competition: 25,
        ticket: 30,
        production: 35,
        launchSpeed: 30,
        scalability: 38,
        margin: 32,
        total: 35,
      },
      intentMatchScore: 20,
      estimatedProfit: 800,
      investmentScore: 30,
      uniquenessScore: 20,
    };

    const validation = validateOpportunity(weak);
    assert.equal(validation.approved, false);

    assert.throws(
      () => runProductStrategist({ opportunity: weak, validation }),
      /aprovada/
    );
  });

  it("ranks kit premium highly for fast validation scenarios", () => {
    const validation = validateOpportunity(strongOpportunity);
    const result = strategizeProduct(strongOpportunity, validation);
    const kit = result.strategies.find((s) => s.strategyType === "kit_premium");

    assert.ok(kit);
    assert.equal(kit.estimatedLaunchTime, 3);
    assert.ok(kit.estimatedMargin >= 95);
  });

  it("recommendation has highest total score among strategies", () => {
    const validation = validateOpportunity(strongOpportunity);
    const result = strategizeProduct(strongOpportunity, validation);
    const topScore = Math.max(...result.strategies.map((s) => s.scores.total));

    assert.equal(result.recommendation.scores.total, topScore);
  });
});

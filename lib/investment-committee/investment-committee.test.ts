import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INVESTMENT_APPROVAL_THRESHOLD,
  isInvestmentApproved,
  isSpecialistApproved,
  scoreCeo,
  scoreCmo,
  scoreCopyChief,
  scorePerformanceManager,
  scoreProductSpecialist,
  SPECIALIST_MIN_APPROVAL,
  computeInvestmentScore,
} from "@/lib/investment-committee/investment-committee-score";
import {
  isCommitteeApproved,
  runInvestmentCommittee,
} from "@/lib/investment-committee/investment-committee";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import { buildSalesPackage } from "@/utils/sales-system";

const strongMeta: MasterFlowMetadata = {
  factory_id: "factory-1",
  validation_approved: true,
  validation_score: 92,
  product_quality_score: 92,
  opportunity_engine_score: 88,
  product_strategist_score: 91,
  product_strategy_adherence: { score: 95, aligned: true, pendencies: [] },
  selected_opportunity: {
    title: "Programa Elite de Excel",
    niche: "Excel",
    avatar: "Profissional administrativo",
    problem: "Planilhas mal estruturadas",
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
    reason: "Alta demanda.",
  },
  selected_strategy: {
    id: "B",
    label: "Estratégia B",
    strategyType: "kit_premium",
    strategyName: "Kit Premium",
    ticket: 297,
    ticketLabel: "R$ 297",
    estimatedRevenue: 22000,
    estimatedCost: 200,
    estimatedLaunchTime: 5,
    estimatedMargin: 90,
    estimatedROI: 110,
    scalabilityLabel: "Alta",
    scores: {
      revenue: 90,
      execution: 88,
      scalability: 86,
      speed: 85,
      investment: 88,
      total: 88,
    },
    reason: "Lançamento rápido.",
  },
  product_build_brief: {
    objective: "Criar negócio de Excel",
    niche: "Excel",
    avatar: "Profissional administrativo",
    problem: "Planilhas mal estruturadas",
    selected_strategy_type: "kit_premium",
    selected_strategy_name: "Kit Premium",
    ticket: 297,
    estimated_launch_time: 5,
    margin: 90,
    reason: "Lançamento rápido.",
    opportunity_score: 87,
    validation_score: 92,
    strategist_score: 88,
  },
};

const weakMeta: MasterFlowMetadata = {
  factory_id: "factory-weak",
  validation_approved: false,
  validation_score: 55,
  product_quality_score: 62,
  opportunity_engine_score: 42,
  selected_opportunity: {
    title: "Curso genérico",
    niche: "Marketing Digital",
    avatar: "Iniciante",
    problem: "Sem clientes",
    market: "Brasil",
    technology: null,
    businessModel: "Consultoria",
    confidence: 40,
    recommendedProduct: "Curso",
    price: 47,
    opportunityScore: {
      demand: 42,
      competition: 28,
      ticket: 35,
      production: 38,
      launchSpeed: 32,
      scalability: 40,
      margin: 36,
    total: 38,
  },
  intentMatchScore: 15,
  estimatedProfit: 800,
    investmentScore: 30,
    uniquenessScore: 22,
    reason: "Nicho saturado.",
  },
};

function buildStrongPackage() {
  return buildSalesPackage({
    meta: strongMeta,
    productId: "prod-1",
    offerId: "offer-1",
    landingId: "land-1",
    copylabId: "copy-1",
    creativeAssetId: "creative-1",
    checkoutUrl: "https://pay.example.com/checkout",
    commercialScore: 94,
  });
}

function buildWeakPackage() {
  return buildSalesPackage({
    meta: weakMeta,
    productId: "prod-weak",
    offerId: "offer-weak",
    landingId: null,
    copylabId: null,
    creativeAssetId: null,
    checkoutUrl: null,
    commercialScore: 58,
  });
}

describe("investment committee — specialists", () => {
  it("scores each specialist between 0 and 100", () => {
    const pkg = buildStrongPackage();
    const brief = strongMeta.product_build_brief ?? null;

    const scores = [
      scoreCeo({ meta: strongMeta, brief }),
      scoreCmo({ salesPackage: pkg, meta: strongMeta }),
      scoreCopyChief({ salesPackage: pkg }),
      scoreProductSpecialist({ salesPackage: pkg, meta: strongMeta, brief }),
      scorePerformanceManager({ salesPackage: pkg, meta: strongMeta, brief }),
    ];

    for (const score of scores) {
      assert.ok(score >= 0 && score <= 100);
    }
  });

  it("specialist approval requires score >= 80", () => {
    assert.equal(isSpecialistApproved(80), true);
    assert.equal(isSpecialistApproved(79), false);
    assert.equal(isSpecialistApproved(95), true);
  });
});

describe("investment committee — investment score", () => {
  it("computes weighted average of specialist scores", () => {
    const scores = {
      CEO: 92,
      CMO: 88,
      "Copy Chief": 90,
      "Product Specialist": 91,
      "Performance Manager": 87,
    };
    const total = computeInvestmentScore(scores);
    assert.ok(total >= 88 && total <= 92);
  });

  it("approval requires score >= 90 and all specialists >= 80", () => {
    assert.equal(isInvestmentApproved(90, [80, 80, 80, 80, 80]), true);
    assert.equal(isInvestmentApproved(89, [95, 95, 95, 95, 95]), false);
    assert.equal(isInvestmentApproved(92, [95, 95, 95, 95, 79]), false);
  });
});

describe("investment committee — approval gate", () => {
  it("approves strong missions", () => {
    const report = runInvestmentCommittee({
      salesPackage: buildStrongPackage(),
      meta: strongMeta,
      productBuildBrief: strongMeta.product_build_brief,
    });

    assert.ok(report.investmentScore >= INVESTMENT_APPROVAL_THRESHOLD);
    assert.equal(report.approved, true);
    assert.ok(isCommitteeApproved(report));
    assert.ok(report.specialists.every((s) => s.approved));
    assert.ok(report.globalRecommendation.includes("aprovou"));
    assert.equal(report.mustFix.length, 0);
  });

  it("rejects weak missions with mustFix and rejection message", () => {
    const report = runInvestmentCommittee({
      salesPackage: buildWeakPackage(),
      meta: weakMeta,
    });

    assert.equal(report.approved, false);
    assert.ok(!isCommitteeApproved(report));
    assert.ok(report.investmentScore < INVESTMENT_APPROVAL_THRESHOLD);
    assert.ok(report.globalRecommendation.includes("Não recomendo investir dinheiro nesta missão"));
    assert.ok(report.mustFix.length > 0);

    const rejected = report.specialists.filter((s) => !s.approved);
    assert.ok(rejected.length > 0);
    for (const name of rejected.map((s) => s.name)) {
      assert.ok(report.globalRecommendation.includes(name));
    }
  });

  it("each specialist provides strengths, weaknesses and recommendation", () => {
    const report = runInvestmentCommittee({
      salesPackage: buildStrongPackage(),
      meta: strongMeta,
    });

    for (const specialist of report.specialists) {
      assert.ok(specialist.strengths.length > 0);
      assert.ok(specialist.weaknesses.length > 0);
      assert.ok(specialist.recommendation.length > 0);
      assert.equal(specialist.approved, specialist.score >= SPECIALIST_MIN_APPROVAL);
    }
  });
});

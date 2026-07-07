import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runOpportunityEngine } from "@/lib/opportunity/opportunity-engine";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import {
  buildRecommendationSummary,
  buildTopThreeComparison,
  defaultDecisionFields,
  enrichOpportunityResults,
} from "@/utils/decision-explainer";

const baseRec = (overrides: Partial<OpportunityRecommendation> = {}): OpportunityRecommendation => ({
  title: "Curso — Poucas vendas · Marketing Digital",
  niche: "Marketing Digital",
  avatar: "Empreendedor",
  problem: "Poucas vendas",
  market: "Pequenos negócios (PME)",
  technology: "Inteligência Artificial",
  businessModel: "Curso",
  confidence: 75,
  recommendedProduct: "Curso — Poucas vendas",
  price: 497,
  opportunityScore: {
    demand: 85,
    competition: 70,
    ticket: 80,
    production: 75,
    launchSpeed: 70,
    scalability: 82,
    margin: 78,
    total: 88,
  },
  intentMatchScore: 72,
  estimatedProfit: 12000,
  investmentScore: 70,
  uniquenessScore: 65,
  reason: "Score alto.",
  ...defaultDecisionFields(),
  ...overrides,
});

describe("decision explainer", () => {
  it("enriches recommendation with all 8 decision fields", () => {
    const rec = baseRec();
    const { recommendations } = enrichOpportunityResults(
      [rec],
      { raw: "test", monthlyRevenue: 10000, currency: "BRL" },
      {
        raw: "test",
        financialGoal: { monthlyRevenue: 10000, currency: "BRL" },
        technology: "Inteligência Artificial",
        market: "Pequenos negócios (PME)",
        avatar: "Empreendedores",
        problems: ["Poucas vendas"],
        primaryProblem: "Poucas vendas",
        urgency: null,
        deadline: null,
        desiredBusinessModel: null,
        recommendedBusinessModel: "Curso",
        businessModelJustification: "Teste",
        confidence: 75,
      }
    );

    const enriched = recommendations[0]!;
    assert.ok(enriched.decisionExplanation.length > 20);
    assert.ok(enriched.competitiveAdvantages.length > 0);
    assert.ok(enriched.risks.length > 0);
    assert.ok(enriched.assumptions.length > 0);
    assert.ok(enriched.firstMvp.length > 10);
    assert.ok(enriched.firstSalePlan.length > 10);
    assert.ok(enriched.estimatedInvestment > 0);
    assert.ok(enriched.estimatedValidationTime.length > 3);
  });

  it("builds comparison for TOP 3 with labels", () => {
    const recs = [
      baseRec({ opportunityScore: { ...baseRec().opportunityScore, total: 90 } }),
      baseRec({
        title: "Mentoria — Poucas vendas",
        businessModel: "Mentoria",
        opportunityScore: { ...baseRec().opportunityScore, total: 75 },
      }),
      baseRec({
        title: "Agência — Marketing fraco",
        businessModel: "Agência",
        problem: "Marketing fraco",
        opportunityScore: { ...baseRec().opportunityScore, total: 55, competition: 40 },
        uniquenessScore: 40,
      }),
    ];

    const comparison = buildTopThreeComparison(recs);
    assert.equal(comparison.length, 3);
    assert.equal(comparison[0]!.label, "recomendada");
    assert.equal(comparison[1]!.label, "alternativa");
    assert.equal(comparison[2]!.label, "evitar");
    assert.ok(comparison[0]!.verdict.length > 0);
  });

  it("builds recommendation summary in consultant format", () => {
    const recs = [
      baseRec({ businessModel: "SaaS", opportunityScore: { ...baseRec().opportunityScore, total: 92 } }),
      baseRec({ businessModel: "Mentoria", opportunityScore: { ...baseRec().opportunityScore, total: 78 } }),
      baseRec({ businessModel: "Agência", opportunityScore: { ...baseRec().opportunityScore, total: 50 } }),
    ];
    const comparison = buildTopThreeComparison(recs);
    const summary = buildRecommendationSummary(recs, comparison);

    assert.equal(summary.recommendedOption, 1);
    assert.match(summary.narrative, /Se eu estivesse começando hoje/);
    assert.match(summary.narrative, /Opção 1/);
    assert.ok(summary.optionYCondition.includes("Opção 2"));
    assert.ok(summary.avoidOptionZ.includes("Opção 3"));
  });
});

describe("opportunity engine — decision explainer integration", () => {
  it("returns comparison and recommendation summary", () => {
    const result = runOpportunityEngine(
      "Quero ganhar R$10.000 por mês usando IA para pequenos negócios"
    );

    assert.equal(result.comparison.length, 3);
    assert.ok(result.recommendationSummary.narrative.length > 40);
    assert.ok(result.recommendations[0]!.decisionExplanation.length > 20);
    assert.ok(result.recommendations.every((r) => r.firstMvp && r.estimatedInvestment > 0));
  });
});

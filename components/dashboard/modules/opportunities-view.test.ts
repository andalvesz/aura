import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractValidationInsights } from "@/lib/validation/validation-engine";
import { validateOpportunity } from "@/lib/validation/validation-engine";
import { strategizeProduct } from "@/lib/product-strategist/product-strategist";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import { defaultDecisionFields } from "@/utils/decision-explainer";

const approvedOpportunity: OpportunityRecommendation = {
  title: "Programa Elite — Excel",
  niche: "Excel",
  avatar: "Analista",
  problem: "Baixa produtividade",
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
  reason: "Forte fit.",
  ...defaultDecisionFields(),
};

describe("opportunities dashboard — validation display", () => {
  it("shows validation score and recommendation for approved opportunity", () => {
    const validation = validateOpportunity(approvedOpportunity);
    const insights = extractValidationInsights(validation);

    assert.equal(validation.approved, true);
    assert.ok(validation.validationScore >= 85);
    assert.ok(insights.strengths.length > 0);
    assert.equal(validation.recommendation, "Recomendo construir este produto.");
  });

  it("shows risks and rejection message for weak opportunity", () => {
    const weak: OpportunityRecommendation = {
      ...approvedOpportunity,
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
    const insights = extractValidationInsights(validation);

    assert.equal(validation.approved, false);
    assert.match(validation.recommendation, /Não recomendo construir este produto/);
    assert.ok(insights.risks.length > 0);
    assert.ok(insights.weaknesses.length > 0);
  });
});

describe("opportunities dashboard — product strategist", () => {
  it("generates strategies after approved validation", () => {
    const validation = validateOpportunity(approvedOpportunity);
    assert.equal(validation.approved, true);

    const result = strategizeProduct(approvedOpportunity, validation);

    assert.ok(result.strategies.length >= 3);
    assert.ok(result.explanation.includes("Recomendo"));
    assert.equal(result.recommendation.id, "A");
  });
});

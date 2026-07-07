import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import {
  computeCompetitionRisk,
  computeExecutionDifficulty,
  computeMarketConfidence,
  computeMarketTiming,
  computeMonetizationPotential,
  computeValidationScore,
  VALIDATION_APPROVAL_THRESHOLD,
} from "@/lib/validation/validation-score";
import {
  extractValidationInsights,
  isValidationApproved,
  validateOpportunity,
} from "@/lib/validation/validation-engine";
import { defaultDecisionFields } from "@/utils/decision-explainer";

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
  ...defaultDecisionFields(),
};

const weakOpportunity: OpportunityRecommendation = {
  title: "Curso genérico — Marketing Digital",
  niche: "Marketing Digital",
  avatar: "Empreendedor iniciante",
  problem: "Não consegue atrair clientes",
  market: "Brasil",
  technology: "Marketing Digital",
  businessModel: "Agência",
  confidence: 45,
  recommendedProduct: "Curso de marketing",
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
  estimatedProfit: 1200,
  investmentScore: 35,
  uniquenessScore: 22,
  reason: "Nicho saturado com ticket baixo.",
  ...defaultDecisionFields(),
};

describe("validation score", () => {
  it("returns all criteria between 0 and 100", () => {
    const result = validateOpportunity(strongOpportunity);

    assert.ok(result.marketConfidence >= 0 && result.marketConfidence <= 100);
    assert.ok(result.competitionRisk >= 0 && result.competitionRisk <= 100);
    assert.ok(result.executionDifficulty >= 0 && result.executionDifficulty <= 100);
    assert.ok(result.monetizationPotential >= 0 && result.monetizationPotential <= 100);
    assert.ok(result.marketTiming >= 0 && result.marketTiming <= 100);
    assert.ok(result.validationScore >= 0 && result.validationScore <= 100);
  });

  it("computes validation score from weighted criteria", () => {
    const criteria = {
      marketConfidence: computeMarketConfidence(strongOpportunity),
      competitionRisk: computeCompetitionRisk(strongOpportunity),
      executionDifficulty: computeExecutionDifficulty(strongOpportunity),
      monetizationPotential: computeMonetizationPotential(strongOpportunity),
      marketTiming: computeMarketTiming(strongOpportunity),
    };

    const score = computeValidationScore(criteria);
    assert.equal(score, validateOpportunity(strongOpportunity).validationScore);
  });
});

describe("validation engine — approval gate", () => {
  it("approves strong opportunities with score >= 85", () => {
    const result = validateOpportunity(strongOpportunity);

    assert.ok(result.validationScore >= VALIDATION_APPROVAL_THRESHOLD);
    assert.equal(result.approved, true);
    assert.equal(result.recommendation, "Recomendo construir este produto.");
    assert.ok(isValidationApproved(result));
  });

  it("rejects weak opportunities with score < 85", () => {
    const result = validateOpportunity(weakOpportunity);

    assert.ok(result.validationScore < VALIDATION_APPROVAL_THRESHOLD);
    assert.equal(result.approved, false);
    assert.match(result.recommendation, /Não recomendo construir este produto/);
    assert.ok(result.reasons.length > 0);
    assert.equal(isValidationApproved(result), false);
  });

  it("extracts strengths, weaknesses and risks", () => {
    const approved = extractValidationInsights(validateOpportunity(strongOpportunity));
    const rejected = extractValidationInsights(validateOpportunity(weakOpportunity));

    assert.ok(approved.strengths.length > 0);
    assert.ok(rejected.weaknesses.length > 0);
    assert.ok(rejected.risks.some((risk) => risk.includes("Validation Score")));
  });
});

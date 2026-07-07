import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIGITAL_NICHES } from "@/lib/opportunity/opportunity-dataset";
import {
  getTopOpportunities,
  parseGoal,
  runOpportunityEngine,
} from "@/lib/opportunity/opportunity-engine";
import {
  computeInvestmentScore,
  computeNicheOpportunityScore,
  computeUniquenessScore,
} from "@/lib/opportunity/opportunity-score";

describe("opportunity score", () => {
  it("returns all criteria between 0 and 100", () => {
    const niche = DIGITAL_NICHES[0]!;
    const score = computeNicheOpportunityScore(niche);

    assert.ok(score.demand >= 0 && score.demand <= 100);
    assert.ok(score.competition >= 0 && score.competition <= 100);
    assert.ok(score.ticket >= 0 && score.ticket <= 100);
    assert.ok(score.production >= 0 && score.production <= 100);
    assert.ok(score.launchSpeed >= 0 && score.launchSpeed <= 100);
    assert.ok(score.scalability >= 0 && score.scalability <= 100);
    assert.ok(score.margin >= 0 && score.margin <= 100);
    assert.ok(score.total >= 0 && score.total <= 100);
  });

  it("computes investment and uniqueness scores", () => {
    const niche = DIGITAL_NICHES.find((n) => n.id === "excel")!;
    const investment = computeInvestmentScore(niche);
    const uniqueness = computeUniquenessScore(niche);

    assert.ok(investment >= 0 && investment <= 100);
    assert.ok(uniqueness >= 0 && uniqueness <= 100);
  });
});

describe("opportunity engine — goal parsing", () => {
  it("parses BRL monthly revenue from natural language", () => {
    const goal = parseGoal("Quero ganhar R$30.000 por mês");
    assert.equal(goal.monthlyRevenue, 30000);
    assert.equal(goal.currency, "BRL");
  });

  it("parses faturar goal", () => {
    const goal = parseGoal("Quero faturar R$20.000 por mês");
    assert.equal(goal.monthlyRevenue, 20000);
  });

  it("defaults to 10000 when no revenue found", () => {
    const goal = parseGoal("Quero criar um negócio digital");
    assert.equal(goal.monthlyRevenue, 10000);
  });
});

describe("opportunity engine — business reasoning", () => {
  it("returns exactly top 3 recommendations", () => {
    const result = runOpportunityEngine("Quero ganhar R$30.000 por mês");

    assert.equal(result.recommendations.length, 3);
    assert.ok(result.totalCandidates >= 3);
    assert.ok(result.recommendations[0]!.opportunityScore.total >= result.recommendations[1]!.opportunityScore.total);
    assert.ok(result.recommendations[1]!.opportunityScore.total >= result.recommendations[2]!.opportunityScore.total);
  });

  it("getTopOpportunities respects limit", () => {
    const top = getTopOpportunities("Quero faturar R$10.000 por mês", 3);
    assert.equal(top.length, 3);
  });

  it("reasons by problem and business model — not niche first", () => {
    const result = runOpportunityEngine(
      "Quero ganhar R$10.000 por mês usando IA para pequenos negócios"
    );

    assert.ok(result.reasoning);
    assert.equal(result.reasoning.technology, "Inteligência Artificial");
    assert.equal(result.reasoning.market, "Pequenos negócios (PME)");
    assert.ok(result.reasoning.primaryProblem.length > 0);
    assert.ok(result.reasoning.recommendedBusinessModel.length > 0);
    assert.ok(result.reasoning.businessModelJustification.includes(result.reasoning.primaryProblem));

    for (const rec of result.recommendations) {
      assert.ok(rec.problem);
      assert.ok(rec.businessModel);
      assert.ok(rec.reason.includes(rec.businessModel));
    }
  });

  it("does not recommend course without business model justification", () => {
    const result = runOpportunityEngine("Automação com IA para pequenos negócios");
    const cursoOnly = result.recommendations.filter((r) => r.businessModel === "Curso");

    if (cursoOnly.length > 0) {
      for (const rec of cursoOnly) {
        assert.ok(rec.reason.length > 40);
        assert.ok(rec.reason.includes("Problema"));
      }
    }

    assert.notEqual(result.reasoning.recommendedBusinessModel, "Curso");
  });

  it("returns reasoning in engine result", () => {
    const result = runOpportunityEngine("IA para pequenos negócios");
    assert.ok(result.reasoning);
    assert.equal(result.reasoning.technology, "Inteligência Artificial");
    assert.ok(result.reasoning.confidence > 0);
    assert.equal(result.comparison.length, 3);
    assert.ok(result.recommendationSummary.narrative.length > 20);
  });
});

describe("opportunity dataset", () => {
  it("has approximately 50 digital niches", () => {
    assert.ok(DIGITAL_NICHES.length >= 50);
  });

  it("each niche has required fields", () => {
    for (const niche of DIGITAL_NICHES) {
      assert.ok(niche.id);
      assert.ok(niche.name);
      assert.ok(niche.avatar);
      assert.ok(niche.problem);
      assert.ok(niche.marketSize > 0);
      assert.ok(niche.ticketRange.min > 0);
      assert.ok(niche.ticketRange.max >= niche.ticketRange.min);
      assert.ok(niche.examples.length > 0);
      assert.ok(niche.digitalProducts.length > 0);
    }
  });
});

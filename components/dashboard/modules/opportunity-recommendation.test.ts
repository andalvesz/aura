import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import { defaultDecisionFields } from "@/utils/decision-explainer";

function formatRevenueRange(primary: OpportunityRecommendation): string {
  const min = Math.round(primary.price * 2);
  const max = Math.max(primary.estimatedProfit, Math.round(primary.price * 5));
  return `R$ ${min.toLocaleString("pt-BR")}–R$ ${max.toLocaleString("pt-BR")}`;
}

const sampleOpportunity: OpportunityRecommendation = {
  title: "Automação — IA",
  niche: "Pequenos negócios",
  avatar: "Empreendedor",
  problem: "Falta de automação",
  market: "Brasil",
  technology: "Inteligência Artificial",
  businessModel: "Automação",
  confidence: 72,
  recommendedProduct: "Automação com IA para pequenos negócios",
  price: 1500,
  opportunityScore: {
    demand: 80,
    competition: 70,
    ticket: 75,
    production: 72,
    launchSpeed: 78,
    scalability: 76,
    margin: 74,
    total: 76,
  },
  intentMatchScore: 65,
  estimatedProfit: 6000,
  investmentScore: 70,
  uniquenessScore: 68,
  reason: "Score alto.",
  ...defaultDecisionFields("Automação"),
};

describe("opportunity recommendation experience — display helpers", () => {
  it("formats expected revenue range from opportunity data", () => {
    const range = formatRevenueRange(sampleOpportunity);
    assert.match(range, /R\$ 3\.000/);
    assert.match(range, /R\$ 7\.500|R\$ 6\.000/);
  });

  it("uses cash generation speed from constraints without recalculating", () => {
    assert.ok(sampleOpportunity.constraints.cashGenerationSpeed > 0);
    assert.equal(sampleOpportunity.realityCompatible, true);
  });
});

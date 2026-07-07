import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "@/app/api/product-strategist/route";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import { validateOpportunity } from "@/lib/validation/validation-engine";

const sampleOpportunity: OpportunityRecommendation = {
  title: "Curso de Excel",
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
};

describe("product strategist API", () => {
  it("returns 400 when opportunity is missing", async () => {
    const validation = validateOpportunity(sampleOpportunity);
    const response = await POST(
      new Request("http://localhost/api/product-strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validation }),
      })
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: string };
    assert.ok(body.error?.includes("opportunity"));
  });

  it("returns 400 when validation is not approved", async () => {
    const weak: OpportunityRecommendation = {
      ...sampleOpportunity,
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

    const response = await POST(
      new Request("http://localhost/api/product-strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: weak, validation }),
      })
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: string };
    assert.ok(body.error?.includes("aprovada"));
  });

  it("returns ProductStrategistResult as JSON", async () => {
    const validation = validateOpportunity(sampleOpportunity);
    const response = await POST(
      new Request("http://localhost/api/product-strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: sampleOpportunity, validation }),
      })
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      strategist?: { strategies: unknown[]; recommendation: unknown; explanation: string };
    };

    assert.ok(body.strategist);
    assert.ok(body.strategist!.strategies.length >= 3);
    assert.ok(body.strategist!.explanation.includes("Recomendo"));
  });

  it("never returns HTML", async () => {
    const validation = validateOpportunity(sampleOpportunity);
    const response = await POST(
      new Request("http://localhost/api/product-strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: sampleOpportunity, validation }),
      })
    );

    const contentType = response.headers.get("content-type") ?? "";
    assert.ok(contentType.includes("application/json"));
    const text = await response.text();
    assert.ok(!text.includes("<!DOCTYPE"));
    assert.ok(!text.includes("<html"));
  });
});

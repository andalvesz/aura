import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "@/app/api/validation-engine/route";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";

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

describe("validation engine API", () => {
  it("returns 400 when opportunity is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/validation-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: string };
    assert.ok(body.error?.includes("opportunity"));
  });

  it("returns ValidationResult as JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/validation-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: sampleOpportunity }),
      })
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      validation?: { approved: boolean; validationScore: number };
    };

    assert.ok(body.validation);
    assert.equal(typeof body.validation?.approved, "boolean");
    assert.ok((body.validation?.validationScore ?? 0) >= 0);
  });

  it("never returns HTML", async () => {
    const response = await POST(
      new Request("http://localhost/api/validation-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: sampleOpportunity }),
      })
    );

    const contentType = response.headers.get("content-type") ?? "";
    assert.ok(contentType.includes("application/json"));
    const text = await response.text();
    assert.ok(!text.includes("<!DOCTYPE"));
    assert.ok(!text.includes("<html"));
  });
});

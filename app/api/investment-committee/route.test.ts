import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "@/app/api/investment-committee/route";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import { buildSalesPackage } from "@/utils/sales-system";

const meta: MasterFlowMetadata = {
  factory_id: "factory-1",
  validation_approved: true,
  validation_score: 90,
  product_quality_score: 90,
  selected_strategy: {
    id: "B",
    label: "Estratégia B",
    strategyType: "kit_premium",
    strategyName: "Kit Premium",
    ticket: 297,
    ticketLabel: "R$ 297",
    estimatedRevenue: 18000,
    estimatedCost: 180,
    estimatedLaunchTime: 3,
    estimatedMargin: 99,
    estimatedROI: 100,
    scalabilityLabel: "Muito Alta",
    scores: {
      revenue: 88,
      execution: 92,
      scalability: 95,
      speed: 98,
      investment: 96,
      total: 93,
    },
    reason: "Lançamento rápido.",
  },
  selected_opportunity: {
    title: "Curso de Excel",
    niche: "Excel",
    avatar: "Profissional",
    problem: "Planilhas",
    market: "Brasil",
    technology: "Excel",
    businessModel: "Curso",
    confidence: 85,
    recommendedProduct: "Curso",
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
  estimatedProfit: 20000,
    investmentScore: 88,
    uniquenessScore: 75,
    reason: "Alta demanda.",
  },
};

const salesPackage = buildSalesPackage({
  meta,
  productId: "prod-1",
  offerId: "offer-1",
  landingId: "land-1",
  copylabId: "copy-1",
  creativeAssetId: "creative-1",
  checkoutUrl: "https://pay.example.com/checkout",
  commercialScore: 93,
});

describe("investment committee API", () => {
  it("returns 400 when salesPackage is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/investment-committee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta }),
      })
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: string };
    assert.ok(body.error?.includes("salesPackage"));
  });

  it("returns InvestmentCommitteeReport as JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/investment-committee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesPackage, meta }),
      })
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      report?: { investmentScore: number; approved: boolean; specialists: unknown[] };
    };

    assert.ok(body.report);
    assert.equal(typeof body.report?.approved, "boolean");
    assert.ok((body.report?.investmentScore ?? 0) >= 0);
    assert.ok((body.report?.specialists.length ?? 0) === 5);
  });

  it("never returns HTML", async () => {
    const response = await POST(
      new Request("http://localhost/api/investment-committee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesPackage, meta }),
      })
    );

    const contentType = response.headers.get("content-type") ?? "";
    assert.ok(contentType.includes("application/json"));
    const text = await response.text();
    assert.ok(!text.includes("<!DOCTYPE"));
    assert.ok(!text.includes("<html"));
  });
});

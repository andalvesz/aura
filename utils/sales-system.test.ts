import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import {
  applySalesStepFailure,
  buildSalesPackage,
  COMMERCIAL_SCORE_MIN_READY,
  computeCommercialScore,
  evaluateReadyToSell,
} from "@/utils/sales-system";

const baseMeta: MasterFlowMetadata = {
  factory_id: "factory-1",
  validation_approved: true,
  product_quality_score: 88,
  selected_strategy: {
    id: "B",
    label: "Estratégia B",
    strategyType: "kit_premium",
    strategyName: "Kit Premium",
    ticket: 97,
    ticketLabel: "R$ 97",
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
};

describe("sales system — commercial score", () => {
  it("computes average commercial score from six dimensions", () => {
    const score = computeCommercialScore({
      produto: 90,
      oferta: 85,
      landing: 88,
      copy: 92,
      criativos: 86,
      checkout: 89,
    });
    assert.equal(score, 88.33);
  });

  it("builds sales package with all assets", () => {
    const pkg = buildSalesPackage({
      meta: baseMeta,
      productId: "prod-1",
      offerId: "offer-1",
      landingId: "land-1",
      copylabId: "copy-1",
      creativeAssetId: "creative-1",
      checkoutUrl: "https://pay.example.com/checkout",
      commercialScore: 92,
    });

    assert.equal(pkg.offer.ready, true);
    assert.equal(pkg.landing.ready, true);
    assert.equal(pkg.copy.ready, true);
    assert.equal(pkg.creativePackage.ready, true);
    assert.equal(pkg.checkout.ready, true);
    assert.equal(pkg.commercialScore, 92);
  });
});

describe("sales system — ready to sell", () => {
  it("requires commercial score >= 90 and all assets", () => {
    const pkg = buildSalesPackage({
      meta: baseMeta,
      productId: "prod-1",
      offerId: "offer-1",
      landingId: "land-1",
      copylabId: "copy-1",
      creativeAssetId: "creative-1",
      checkoutUrl: "https://pay.example.com/checkout",
      commercialScore: 92,
    });

    assert.equal(
      evaluateReadyToSell({ meta: baseMeta, salesPackage: pkg, commercialScore: 92 }),
      true
    );
    assert.equal(pkg.readyToSell, true);
  });

  it("is false when commercial score is below 90", () => {
    const pkg = buildSalesPackage({
      meta: baseMeta,
      productId: "prod-1",
      offerId: "offer-1",
      landingId: "land-1",
      copylabId: "copy-1",
      creativeAssetId: "creative-1",
      checkoutUrl: "https://pay.example.com/checkout",
      commercialScore: 82,
    });

    assert.equal(pkg.readyToSell, false);
    assert.ok(pkg.commercialScore < COMMERCIAL_SCORE_MIN_READY);
  });

  it("is false without validation approval", () => {
    const meta = { ...baseMeta, validation_approved: false };
    const pkg = buildSalesPackage({
      meta,
      productId: "prod-1",
      offerId: "offer-1",
      landingId: "land-1",
      copylabId: "copy-1",
      creativeAssetId: "creative-1",
      checkoutUrl: "https://pay.example.com/checkout",
      commercialScore: 95,
    });

    assert.equal(evaluateReadyToSell({ meta, salesPackage: pkg }), false);
  });
});

describe("sales system — resilient failures", () => {
  it("records pendency when a step fails without breaking package", () => {
    let pkg = buildSalesPackage({
      meta: baseMeta,
      productId: "prod-1",
      offerId: "offer-1",
    });

    pkg = applySalesStepFailure(pkg, "landing_factory", "Falha ao gerar landing.");
    pkg = applySalesStepFailure(pkg, "checkout_engine", "Checkout indisponível.");

    assert.equal(pkg.readyToSell, false);
    assert.equal(pkg.pendingItems.length, 2);
    assert.ok(pkg.pendingItems[0]?.includes("Landing"));
    assert.ok(pkg.pendingItems[1]?.includes("Checkout"));
    assert.equal(pkg.offer.ready, true);
  });

  it("persists sales package in metadata shape", () => {
    const pkg = buildSalesPackage({
      meta: baseMeta,
      productId: "prod-1",
      offerId: "offer-1",
      landingId: "land-1",
      copylabId: "copy-1",
      creativeAssetId: "creative-1",
      checkoutUrl: "https://pay.example.com/checkout",
      commercialScore: 91,
    });

    const metadata: MasterFlowMetadata = {
      sales_package: pkg,
      commercial_score: pkg.commercialScore,
      ready_to_sell: pkg.readyToSell,
      sales_pending_items: pkg.pendingItems,
    };

    assert.ok(metadata.sales_package);
    assert.equal(metadata.commercial_score, 91);
  });
});

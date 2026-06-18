import assert from "node:assert/strict";
import type { ProductFactory, CreativeAsset } from "@/types/database";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { resolveCurrencyForMarket } from "./creator-locale";
import { PUBLISH_ORCHESTRATOR_MASTER_FLOW } from "./publish-orchestrator";
import {
  buildReadyToSellCompleteRequirements,
  buildReadyToSellGappedRequirements,
  buildSuperficialProductFactoryFixture,
  buildEliteProductFactoryFixture,
  runAuraCertificationRuntime,
} from "./aura-certification-runtime";
import { computeProductQualityScore } from "./product-factory-pro";
import { evaluateReadyToSellCertification } from "./revenue-certification";
import { computeCreativeQualityScore, computeHeuristicCreativeScore } from "./creative-director";
import { computeCampaignQualityScore } from "./ads-commander";

describe("revenue certification — reality gates", () => {
  it("Product Factory superficial falha", () => {
    const quality = computeProductQualityScore(
      buildSuperficialProductFactoryFixture() as unknown as ProductFactory
    );
    assert.equal(quality.readyToSell, false);
    assert.ok(quality.score < 85);
  });

  it("Product Factory elite passa", () => {
    const quality = computeProductQualityScore(
      buildEliteProductFactoryFixture() as unknown as ProductFactory
    );
    assert.ok(quality.score >= 85);
    assert.equal(quality.readyToSell, true);
  });

  it("READY_TO_SELL com gaps falha", () => {
    const cert = evaluateReadyToSellCertification(buildReadyToSellGappedRequirements());
    assert.equal(cert.ready, false);
    assert.ok(cert.gaps.length > 0);
  });

  it("READY_TO_SELL completo passa", () => {
    const cert = evaluateReadyToSellCertification(buildReadyToSellCompleteRequirements());
    assert.equal(cert.ready, true);
    assert.equal(cert.commercial_status, "ready_to_sell");
  });

  it("checkout US usa USD", () => {
    assert.equal(
      resolveCurrencyForMarket({ country: "US", language: "en-US" }),
      "USD"
    );
  });

  it("BRL não aparece em cenário US", () => {
    assert.notEqual(
      resolveCurrencyForMarket({ country: "Estados Unidos", language: "Inglês" }),
      "BRL"
    );
  });

  it("ads publish sem landing falha", () => {
    const adsPublishSrc = fs.readFileSync(
      path.join(process.cwd(), "lib/supabase/services/ads-publish.service.ts"),
      "utf8"
    );
    assert.ok(adsPublishSrc.includes("Campanha não pode ser publicada sem landing_url real."));
    assert.ok(!adsPublishSrc.includes("example.com"));
  });

  it("bypass de aprovação não existe", () => {
    assert.equal(PUBLISH_ORCHESTRATOR_MASTER_FLOW.bypassExplicitApproval, false);
  });

  it("cert global falha se creative stage <85", () => {
    const weakAssets = [
      { id: "w1", asset_type: "image", title: "Weak", copy: "x", status: "ready" },
    ];
    const weak = computeCreativeQualityScore({
      creativeScore: computeHeuristicCreativeScore({
        assets: weakAssets as unknown as CreativeAsset[],
        copyHeadline: "x",
      }),
      assets: weakAssets as unknown as CreativeAsset[],
      copyHeadline: "x",
    });
    assert.ok(weak.overall < 85);

    const runtime = runAuraCertificationRuntime();
    const creativeStage = runtime.stages.find((stage) => stage.id === "creative_director");
    assert.ok(creativeStage);
    if (creativeStage.score < 85) {
      assert.notEqual(runtime.certified, true);
    }
  });

  it("cert global falha se campaign stage <85", () => {
    const weak = computeCampaignQualityScore({
      adSetsCount: 0,
      creativesCount: 0,
      audienceSuggestions: [],
      riskAnalysis: null,
      hasLanding: false,
      hasCopy: false,
    });
    assert.ok(weak.campaign_quality_score < 85);
  });
});

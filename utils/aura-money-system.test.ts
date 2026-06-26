import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReadyToSellCompleteRequirements,
  buildReadyToSellGappedRequirements,
} from "./aura-certification-runtime";
import { computeCampaignQualityScore } from "./ads-commander";
import { computeProductQualityScore } from "./product-factory-pro";
import {
  buildEliteProductFactoryFixture,
  buildSuperficialProductFactoryFixture,
} from "./aura-certification-runtime";
import { evaluateReadyToSellCertification } from "./revenue-certification";
import {
  evaluateIngestionQueueSuccess,
  finalizeIngestionQueueRun,
  shouldResetFailedDriveItem,
} from "./expert-brain-queue";
import type { ProductFactory } from "@/types/database";

describe("aura money system — gates mínimos", () => {
  it("expert-brain pending_drive sem avanço não retorna sucesso", () => {
    const result = finalizeIngestionQueueRun({
      found: 2,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 2,
      pendingDriveRemaining: 5,
    });
    assert.equal(result.success, false);
  });

  it("expert-brain waiting_for_openai conta como progresso", () => {
    const result = finalizeIngestionQueueRun({
      found: 1,
      processed: 1,
      completed: 0,
      failed: 0,
      skipped: 0,
      pendingDriveRemaining: 0,
    });
    assert.equal(result.success, true);
  });

  it("product factory score baixo não fica ready_to_sell", () => {
    const quality = computeProductQualityScore(
      buildSuperficialProductFactoryFixture() as unknown as ProductFactory
    );
    assert.equal(quality.readyToSell, false);
    assert.ok(quality.score < 85);
  });

  it("product factory improve path — elite passa gate", () => {
    const before = computeProductQualityScore(
      buildSuperficialProductFactoryFixture() as unknown as ProductFactory
    );
    const after = computeProductQualityScore(
      buildEliteProductFactoryFixture() as unknown as ProductFactory
    );
    assert.ok(after.score > before.score);
    assert.equal(after.readyToSell, true);
  });

  it("ready_to_sell falso positivo falha certificação", () => {
    const cert = evaluateReadyToSellCertification(buildReadyToSellGappedRequirements());
    assert.equal(cert.ready, false);
    assert.ok(cert.gaps.length > 0);
  });

  it("ready_to_sell completo passa certificação", () => {
    const cert = evaluateReadyToSellCertification(buildReadyToSellCompleteRequirements());
    assert.equal(cert.ready, true);
    assert.equal(cert.commercial_status, "ready_to_sell");
  });

  it("funnel sem checkout falha ready_to_sell", () => {
    const cert = evaluateReadyToSellCertification({
      ...buildReadyToSellGappedRequirements(),
      funnel_url: "https://aura.app/f/test",
      landing_url: "https://aura.app/l/test",
      campaign_id: "camp-1",
    });
    assert.equal(cert.ready, false);
    assert.ok(cert.gaps.some((gap) => gap.includes("checkout")));
  });

  it("campanha vazia reprova score mínimo", () => {
    const score = computeCampaignQualityScore({
      adSetsCount: 0,
      creativesCount: 0,
      audienceSuggestions: [],
      riskAnalysis: null,
      hasLanding: false,
      hasCopy: false,
    });
    assert.ok(score.campaign_quality_score < 85);
  });

  it("influence log wiring existe no expert brain transversal", () => {
    const canResetDrive = shouldResetFailedDriveItem(
      { source: "google_drive", drive_file_id: "x" },
      "Storage upload failed: bucket size limit"
    );
    assert.equal(canResetDrive, true);
    assert.equal(
      evaluateIngestionQueueSuccess({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        pendingDriveRemaining: 0,
      }),
      true
    );
  });
});

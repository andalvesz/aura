import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdCampaign } from "@/types/database";
import {
  canApproveCampaign,
  computeAdsCommanderDashboard,
  getAdCampaignStatusLabel,
} from "./ads-commander";

describe("ads-commander", () => {
  it("labels campaign status", () => {
    assert.equal(getAdCampaignStatusLabel("ready_to_publish"), "Pronta para publicar");
    assert.equal(getAdCampaignStatusLabel("pending_approval"), "Aguardando aprovação");
  });

  it("allows approve only for pending_approval", () => {
    assert.equal(canApproveCampaign("pending_approval"), true);
    assert.equal(canApproveCampaign("ready_to_publish"), false);
    assert.equal(canApproveCampaign("draft"), false);
  });

  it("computes dashboard metrics", () => {
    const campaigns = [
      {
        id: "c1",
        user_id: "u1",
        operation_id: "op1",
        platform: "meta",
        campaign_name: "Test Campaign",
        objective: "conversao",
        budget: 100,
        country: "BR",
        language: "pt-BR",
        audience: {},
        creatives_json: [],
        copy_json: {},
        landing_id: null,
        status: "pending_approval",
        approval_required: true,
        metadata: {
          budget_suggestion: { daily_min: 30, daily_max: 80, monthly_estimate: 1500, level: "medio", rationale: "", currency: "BRL" },
          audience_suggestions: [{ name: "Interesses", type: "interest", targeting: "x", rationale: "y", score: 85 }],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as AdCampaign[];

    const dashboard = computeAdsCommanderDashboard({
      campaigns,
      adSetsByCampaign: new Map([["c1", [{ id: "s1", campaign_id: "c1", audience: {}, placements: [], budget: 50, status: "ready", metadata: {}, created_at: "" }]]]),
      creativesByCampaign: new Map([["c1", [{ id: "cr1", campaign_id: "c1", creative_asset_id: null, headline: "Headline teste", primary_text: "Texto", description: null, cta: "CTA", status: "ready", metadata: {}, created_at: "" }]]]),
    });

    assert.equal(dashboard.campanhasPreparadas, 1);
    assert.equal(dashboard.campanhasAguardandoAprovacao, 1);
    assert.equal(dashboard.melhorPublico, "Interesses");
    assert.equal(dashboard.melhorCriativo, "Headline teste");
    assert.equal(dashboard.safeMode.active, true);
  });
});

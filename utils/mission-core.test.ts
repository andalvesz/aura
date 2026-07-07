import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MasterFlow } from "@/types/database";
import { jsonRouteError } from "@/utils/api-json-route";
import {
  buildMissionArtifacts,
  buildMissionStatus,
  isStepCompleted,
  planRunUntilBlockedIteration,
  shouldBlockBeforeExecution,
  RUN_UNTIL_BLOCKED_MAX_STEPS,
  MISSION_APPROVAL_GATE_STEP,
} from "@/utils/mission-core";

function makeFlow(overrides: Partial<MasterFlow> = {}): MasterFlow {
  return {
    id: "flow-1",
    user_id: "user-1",
    status: "running",
    current_step: "opportunity_engine",
    progress: 0,
    product_id: null,
    funnel_id: null,
    campaign_id: null,
    metadata: { completed_steps: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("mission core — runUntilBlocked planning", () => {
  it("para no approval gate antes de publicar", () => {
    assert.equal(shouldBlockBeforeExecution(MISSION_APPROVAL_GATE_STEP), true);
    assert.equal(MISSION_APPROVAL_GATE_STEP, "mission_review");
    assert.equal(shouldBlockBeforeExecution("product_factory"), false);

    const flow = makeFlow({ current_step: MISSION_APPROVAL_GATE_STEP });
    assert.equal(planRunUntilBlockedIteration({ flow, iteration: 0 }), "blocked");
  });

  it("não reexecuta etapa já concluída", () => {
    const flow = makeFlow({
      current_step: "copylab",
      metadata: { completed_steps: ["opportunity_engine", "validation_engine", "decision_engine", "product_factory", "copylab"] },
    });
    assert.equal(isStepCompleted(flow, "copylab"), true);
    assert.equal(planRunUntilBlockedIteration({ flow, iteration: 0 }), "skip_completed");
  });

  it("executa múltiplas iterações até o limite", () => {
    const flow = makeFlow({ current_step: "product_factory" });
    assert.equal(planRunUntilBlockedIteration({ flow, iteration: 0 }), "execute");
    assert.equal(
      planRunUntilBlockedIteration({ flow, iteration: RUN_UNTIL_BLOCKED_MAX_STEPS }),
      "max_iterations"
    );
  });

  it("start mission — buildMissionStatus reflete flow recém-criado", () => {
    const flow = makeFlow({
      current_step: "opportunity_engine",
      metadata: { user_intent: "Quero criar um negócio de fitness", completed_steps: [] },
    });
    const mission = buildMissionStatus(flow);
    assert.equal(mission.flow_id, "flow-1");
    assert.equal(mission.current_step, "opportunity_engine");
    assert.deepEqual(mission.completed_steps, []);
    assert.equal(mission.failed_step, null);
  });

  it("buildMissionStatus inclui pendências explícitas de checkout, landing e campanha", () => {
    const flow = makeFlow({
      current_step: MISSION_APPROVAL_GATE_STEP,
      product_id: "prod-1",
      campaign_id: "camp-1",
      metadata: {
        completed_steps: ["ads_commander"],
        landing_id: "land-1",
        checkout_url: null,
        landing_published: false,
      },
    });

    const mission = buildMissionStatus(flow);
    assert.ok(mission.pendencies.includes("Checkout não conectado"));
    assert.ok(mission.pendencies.includes("Landing ainda não publicada"));
    assert.ok(mission.pendencies.includes("Campanha preparada, aguardando aprovação"));
  });

  it("buildMissionStatus inclui artefatos e próxima ação no gate", () => {
    const flow = makeFlow({
      current_step: MISSION_APPROVAL_GATE_STEP,
      product_id: "prod-1",
      campaign_id: "camp-1",
      metadata: {
        completed_steps: [
          "opportunity_engine",
          "validation_engine",
          "decision_engine",
          "product_factory",
          "copylab",
          "offer_engine",
          "funnel_engine",
          "funnel_pages",
          "checkout_engine",
          "creative_director",
          "ads_commander",
        ],
        opportunity_name: "Programa Fitness Pro",
        copylab_id: "copy-1",
        offer_id: "offer-1",
        landing_id: "land-1",
        creative_asset_id: "creative-1",
      },
    });

    const mission = buildMissionStatus(flow);
    const artifacts = buildMissionArtifacts(
      (flow.metadata ?? {}) as import("@/utils/master-flow").MasterFlowMetadata,
      flow
    );

    assert.equal(artifacts.product.id, "prod-1");
    assert.equal(artifacts.copy.id, "copy-1");
    assert.equal(artifacts.campaign.prepared, true);
    assert.ok(mission.blocked_reason);
    assert.ok(mission.next_action.length > 0);
    assert.equal(mission.is_ready_for_review, true);
    assert.ok(mission.publication_checklist.length >= 6);
  });

  it("terminal next_action usa label de revisão", () => {
    const flow = makeFlow({
      status: "completed",
      current_step: "done",
      progress: 100,
      metadata: { completed_steps: ["ads_commander"], checkout_url: null },
    });
    const mission = buildMissionStatus(flow);
    assert.match(mission.next_action, /Missão preparada para revisão/);
  });

  it("exibe pacote comercial, investment score e aprovação na revisão", () => {
    const flow = makeFlow({
      current_step: "mission_review",
      status: "paused",
      product_id: "prod-1",
      metadata: {
        completed_steps: ["sales_system", "investment_committee"],
        commercial_score: 91,
        ready_to_sell: true,
        investment_score: 93,
        investment_approved: true,
        investment_recommendation: "Comitê aprovou o investimento.",
        investment_must_fix: [],
        investment_specialists: [
          {
            name: "CEO",
            score: 92,
            approved: true,
            strengths: ["Mercado sólido."],
            weaknesses: ["Sem fraquezas críticas."],
            recommendation: "Aprovado.",
          },
        ],
        sales_package: {
          product: { id: "prod-1", ready: true, score: 90 },
          offer: { id: "offer-1", ready: true, score: 88 },
          landing: { id: "land-1", url: "https://example.com", ready: true, score: 92 },
          copy: { id: "copy-1", ready: true, score: 89 },
          creativePackage: { id: "creative-1", ready: true, score: 87 },
          checkout: { id: "chk-1", url: "https://pay.example.com", ready: true, score: 91 },
          commercialScore: 91,
          readyToSell: true,
          pendingItems: [],
        },
      },
    });

    const mission = buildMissionStatus(flow);
    assert.ok(mission.sales_package);
    assert.equal(mission.commercial_score, 91);
    assert.equal(mission.ready_to_sell, true);
    assert.equal(mission.investment_score, 93);
    assert.equal(mission.investment_approved, true);
    assert.equal(mission.investment_specialists.length, 1);
    assert.equal(mission.is_ready_for_review, true);

    const investmentChecklist = mission.publication_checklist.find((item) => item.id === "investment");
    const approvedChecklist = mission.publication_checklist.find(
      (item) => item.id === "investment_approved"
    );
    assert.equal(investmentChecklist?.done, true);
    assert.equal(approvedChecklist?.done, true);
  });

  it("next_action exibe rejeição do investment committee", () => {
    const flow = makeFlow({
      current_step: "mission_review",
      status: "paused",
      metadata: {
        completed_steps: ["sales_system", "investment_committee"],
        investment_approved: false,
        investment_recommendation: "Não recomendo investir dinheiro nesta missão.",
        investment_must_fix: ["[CMO] Oferta abaixo do patamar."],
        sales_package: {
          product: { id: "prod-1", ready: true, score: 70 },
          offer: { id: "offer-1", ready: true, score: 65 },
          landing: { id: "land-1", ready: true, score: 68 },
          copy: { id: "copy-1", ready: true, score: 66 },
          creativePackage: { id: "creative-1", ready: true, score: 64 },
          checkout: { id: "chk-1", url: "https://pay.example.com", ready: true, score: 62 },
          commercialScore: 66,
          readyToSell: false,
          pendingItems: [],
        },
      },
    });

    const mission = buildMissionStatus(flow);
    assert.match(mission.next_action, /Não recomendo investir dinheiro nesta missão/);
    assert.equal(mission.investment_approved, false);
    assert.ok(mission.investment_must_fix.length > 0);
  });
});

describe("mission core — API JSON errors", () => {
  it("retorna JSON em erro", async () => {
    const response = jsonRouteError("master-flow", new Error("Falha simulada"), 500);
    assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
    const body = (await response.json()) as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, "Falha simulada");
  });
});

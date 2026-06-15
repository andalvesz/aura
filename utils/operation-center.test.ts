import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMissingForApproval,
  computeOperationalScore,
  computeOperationSteps,
  detectOperationCenterCoachMode,
  parseOperationSteps,
} from "./operation-center";
import type { OperationCenter } from "@/types/database";

const baseOperation: OperationCenter = {
  id: "op-1",
  user_id: "user-1",
  status: "preparing",
  titulo: "Teste",
  product_id: "prod-1",
  product_nome: "Produto Teste",
  ceo_session_id: null,
  smart_launch_session_id: null,
  copylab_id: "copy-1",
  assets_id: null,
  landing_id: null,
  orchestration_id: null,
  performance_report_id: null,
  steps: {},
  operational_score: 0,
  success_chance: 70,
  roi_previsto: 2.5,
  next_steps: [],
  executive_logs: [],
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

test("detectOperationCenterCoachMode", () => {
  assert.equal(detectOperationCenterCoachMode("O que falta para aprovar?"), "op-missing-approval");
  assert.equal(detectOperationCenterCoachMode("Continue a operação"), "op-continue");
  assert.equal(detectOperationCenterCoachMode("Gere os criativos"), "op-generate-creatives");
  assert.equal(detectOperationCenterCoachMode("Monte a campanha"), "op-prepare-campaign");
  assert.equal(detectOperationCenterCoachMode("Aprovar operação"), "op-approve");
});

test("computeOperationalScore respects weights", () => {
  const steps = parseOperationSteps({
    produto: "done",
    persona: "done",
    oferta: "done",
    copy: "done",
    criativos: "done",
    landing: "done",
    meta_ads: "done",
    performance_ai: "done",
    aprovacao: "pending",
  });

  const score = computeOperationalScore({
    steps,
    metaConnected: true,
    kiwifyConnected: true,
    roiPrevisto: 1,
  });

  assert.equal(score, 100);
});

test("buildMissingForApproval lists incomplete steps", () => {
  const steps = computeOperationSteps({
    operation: baseOperation,
    bundle: {
      product: {
        id: "prod-1",
        user_id: "user-1",
        nome: "P",
        nicho: null,
        avatar: "Avatar",
        publico_alvo: null,
        problema: null,
        solucao: null,
        promessa: null,
        diferencial: null,
        preco: null,
        status: "ativo",
        pipeline_stage: "validacao",
        target_country: "BR",
        target_language: "pt-BR",
        currency: "BRL",
        created_at: "",
        updated_at: "",
      },
      validation: null,
      offer: { id: "o1" } as never,
      launch: null,
      checklist: [],
    },
    metaConnected: false,
    kiwifyConnected: false,
    hasPerformanceReport: false,
  });

  const missing = buildMissingForApproval(steps, {
    metaConnected: false,
    kiwifyConnected: false,
  });

  assert.ok(missing.includes("Criativos"));
  assert.ok(missing.includes("Meta conectada"));
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMissingForApproval,
  computeOperationalScore,
  computeOperationSteps,
  detectOperationCenterCoachMode,
  isOperationMutable,
  isOperationTerminal,
  OPERATION_TERMINAL_ERROR,
  parseOperationSteps,
  resolveCeoOperationCommand,
  resolveContinueOperationAction,
} from "./operation-center";
import type { OperationCenter } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";

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

const fullBundle: CreatorProductBundle = {
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
};

function completeOperation(
  overrides: Partial<OperationCenter> = {}
): OperationCenter {
  return {
    ...baseOperation,
    assets_id: "assets-1",
    landing_id: "landing-1",
    orchestration_id: "orch-1",
    performance_report_id: "perf-1",
    ...overrides,
  };
}

test("detectOperationCenterCoachMode", () => {
  assert.equal(detectOperationCenterCoachMode("O que falta para aprovar?"), "op-missing-approval");
  assert.equal(detectOperationCenterCoachMode("Continue a operação"), "op-continue");
  assert.equal(detectOperationCenterCoachMode("Gere os criativos"), "op-generate-creatives");
  assert.equal(detectOperationCenterCoachMode("Monte a campanha"), "op-prepare-campaign");
  assert.equal(detectOperationCenterCoachMode("Aprovar operação"), "op-approve");
});

test("resolveCeoOperationCommand routes CEO operational phrases", () => {
  assert.equal(resolveCeoOperationCommand("Continue a operação"), "continue");
  assert.equal(resolveCeoOperationCommand("Execute etapa Copy"), "copy");
  assert.equal(resolveCeoOperationCommand("Execute etapa Criativos"), "creatives");
  assert.equal(resolveCeoOperationCommand("Execute Landing"), "landing");
  assert.equal(resolveCeoOperationCommand("Prepare Meta Ads"), "campaign");
  assert.equal(resolveCeoOperationCommand("Execute Performance AI"), "performance");
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
    bundle: fullBundle,
    metaConnected: false,
    kiwifyConnected: false,
    hasPerformanceReport: false,
  });

  const missing = buildMissingForApproval(
    steps,
    {
      metaConnected: false,
      kiwifyConnected: false,
    },
    baseOperation
  );

  assert.ok(missing.includes("Criativos"));
  assert.ok(missing.includes("Meta conectada"));
});

test("meta connected without orchestration_id does not mark meta_ads done or allow approval", () => {
  const operation = completeOperation({
    orchestration_id: null,
    performance_report_id: "perf-1",
  });

  const steps = computeOperationSteps({
    operation,
    bundle: fullBundle,
    metaConnected: true,
    kiwifyConnected: true,
    hasPerformanceReport: false,
  });

  assert.notEqual(steps.meta_ads, "done");
  assert.equal(steps.meta_ads, "in_progress");

  const missing = buildMissingForApproval(
    steps,
    { metaConnected: true, kiwifyConnected: true },
    operation
  );

  assert.ok(missing.includes("Meta Ads"));
});

test("global performance report without performance_report_id does not mark performance_ai done or allow approval", () => {
  const operation = completeOperation({
    orchestration_id: "orch-1",
    performance_report_id: null,
  });

  const steps = computeOperationSteps({
    operation,
    bundle: fullBundle,
    metaConnected: true,
    kiwifyConnected: true,
    hasPerformanceReport: true,
  });

  assert.notEqual(steps.performance_ai, "done");

  const missing = buildMissingForApproval(
    steps,
    { metaConnected: true, kiwifyConnected: true },
    operation
  );

  assert.ok(missing.includes("Performance AI"));
});

test("approval gates open only when orchestration_id and performance_report_id exist on operation", () => {
  const operation = completeOperation();

  const steps = computeOperationSteps({
    operation,
    bundle: fullBundle,
    metaConnected: true,
    kiwifyConnected: true,
    hasPerformanceReport: false,
  });

  assert.equal(steps.meta_ads, "done");
  assert.equal(steps.performance_ai, "done");

  const missing = buildMissingForApproval(
    steps,
    { metaConnected: true, kiwifyConnected: true },
    operation
  );

  assert.equal(missing.length, 0);
});

test("ready operation is terminal and cannot be mutated", () => {
  assert.equal(isOperationTerminal("ready"), true);
  assert.equal(isOperationTerminal("approved"), true);
  assert.equal(isOperationTerminal("cancelled"), true);
  assert.equal(isOperationMutable("preparing"), true);
  assert.equal(isOperationMutable("ready"), false);
  assert.equal(OPERATION_TERMINAL_ERROR, "Esta operação já está finalizada ou cancelada.");
});

test("resolveContinueOperationAction routes copy step", () => {
  assert.equal(resolveContinueOperationAction("Concluir etapa: Copy"), "copy");
  assert.equal(resolveContinueOperationAction("Concluir etapa: Criativos"), "creatives");
  assert.equal(resolveContinueOperationAction("Concluir etapa: Meta Ads"), "campaign");
  assert.equal(resolveContinueOperationAction("Enviar para Performance AI"), "performance");
});

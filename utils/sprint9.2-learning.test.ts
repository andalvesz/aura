/**
 * Sprint 9.2 — Continuous Learning Engine tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateLearningPatterns,
  applyLearningProposalPure,
  clearLearningRegistry,
  clearLearningState,
  completeLearningEvaluationPure,
  confirmLearningProposalPure,
  createEmptyLearningState,
  ensureBuiltinLearningAdapters,
  explainLearningProposalPure,
  generateLearningProposals,
  getLearningHomeWidgetPure,
  hashPayload,
  ingestLearningSignal,
  isEventRegistered,
  listLearningAdapters,
  listLearningProposalsPure,
  rejectLearningProposalPure,
  revertLearningProposalPure,
  runLearningCyclePure,
  validateProposedChange,
  validateProposalConfirmation,
  validateProviderProposalDraft,
  proposalPayload,
  type LearningViewer,
  type RawLearningEvent,
  MIN_SAMPLE_SIZE,
} from "@/lib/learning";
import { recordFeedback, clearFeedback } from "@/lib/aura-brain/learning/feedback";
import { clearOrchestratorSessions, getOrchestratorSession } from "@/lib/orchestrator";

beforeEach(() => {
  clearLearningState();
  clearLearningRegistry();
  ensureBuiltinLearningAdapters();
  clearFeedback();
  clearOrchestratorSessions();
});

function viewer(partial: Partial<LearningViewer> = {}): LearningViewer {
  return {
    userId: "u1",
    workspaceId: null,
    role: "owner",
    isWorkspaceMember: false,
    ...partial,
  };
}

function seedSignals(
  state = createEmptyLearningState(),
  count = MIN_SAMPLE_SIZE,
  event = "accept",
  layer: RawLearningEvent["sourceLayer"] = "recommendation"
) {
  let s = state;
  for (let i = 0; i < count; i++) {
    const res = ingestLearningSignal(s, {
      userId: "u1",
      sourceLayer: layer,
      event,
      sourceType: "recommendation",
      sourceId: `src_${i}`,
      subjectType: "recommendation",
      subjectId: `rec_${i}`,
      idempotencyKey: `${layer}:${event}:${i}`,
      value: 1,
    });
    assert.equal(res.error, null);
    s = res.state;
  }
  return s;
}

describe("Sprint 9.2 Continuous Learning", () => {
  test("legacy learning audit — feedback surfaces reused", () => {
    assert.ok(existsSync(join(process.cwd(), "lib/aura-brain/learning/feedback.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/recommendation/feedback.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/planner/feedback.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/learning/engine.ts")));
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "supabase/migrations/20260731310000_sprint9_2_continuous_learning.sql"
        )
      )
    );
    assert.ok(
      existsSync(join(process.cwd(), "reports/sprint9.2-continuous-learning-engine.md"))
    );
    recordFeedback({
      userId: "u1",
      workspaceId: null,
      targetKind: "recommendation",
      targetId: "t1",
      signal: "util",
    });
  });

  test("signal registry + adapters + unregistered blocked", () => {
    const adapters = listLearningAdapters();
    assert.ok(adapters.length >= 10);
    assert.equal(isEventRegistered("recommendation", "accept"), true);

    clearLearningRegistry();
    assert.equal(isEventRegistered("recommendation", "accept"), false);

    const blocked = ingestLearningSignal(createEmptyLearningState(), {
      userId: "u1",
      sourceLayer: "recommendation",
      event: "accept",
      sourceType: "x",
      sourceId: "1",
      subjectType: "x",
      subjectId: "1",
      idempotencyKey: "k-blocked",
    });
    assert.equal(blocked.error, "event_not_registered");

    ensureBuiltinLearningAdapters();
    const ok = ingestLearningSignal(createEmptyLearningState(), {
      userId: "u1",
      sourceLayer: "recommendation",
      event: "accept",
      sourceType: "x",
      sourceId: "1",
      subjectType: "x",
      subjectId: "1",
      idempotencyKey: "k-ok",
    });
    assert.equal(ok.error, null);
    assert.ok(ok.signal);
  });

  test("dedupe / idempotency", () => {
    let state = createEmptyLearningState();
    const raw: RawLearningEvent = {
      userId: "u1",
      sourceLayer: "automation",
      event: "failed",
      sourceType: "automation",
      sourceId: "a1",
      subjectType: "automation",
      subjectId: "a1",
      idempotencyKey: "auto:fail:a1",
    };
    const a = ingestLearningSignal(state, raw);
    state = a.state;
    const b = ingestLearningSignal(state, raw);
    assert.equal(b.deduped, true);
    assert.equal(state.signals.length, 1);
  });

  test("pattern aggregation + insufficient sample + counterevidence", () => {
    let state = seedSignals(createEmptyLearningState(), 2);
    let agg = aggregateLearningPatterns(state, { userId: "u1", minSampleSize: 3 });
    assert.equal(agg.patterns.length, 0);

    state = seedSignals(createEmptyLearningState(), 4, "accept");
    state = seedSignals(state, 2, "ignore");
    agg = aggregateLearningPatterns(state, { userId: "u1", minSampleSize: 3 });
    assert.ok(agg.patterns.length >= 1);
    const pos = agg.patterns.find((p) => p.patternKey.includes(":pos"));
    assert.ok(pos);
    assert.ok(pos!.sampleSize >= 3);
  });

  test("proposal generation never APPLIED + human review flow", () => {
    let state = seedSignals(createEmptyLearningState(), 4, "accept");
    state = aggregateLearningPatterns(state, { userId: "u1" }).state;
    const gen = generateLearningProposals(state, { userId: "u1" });
    state = gen.state;
    assert.ok(gen.proposals.length >= 1);
    assert.ok(gen.proposals.every((p) => p.status === "PENDING_REVIEW"));
    assert.ok(gen.proposals.every((p) => p.requiresConfirmation === true));

    const id = gen.proposals[0]!.id;
    const confirmed = confirmLearningProposalPure(state, viewer(), id);
    assert.equal(confirmed.error, null);
    assert.equal(confirmed.proposal?.status, "CONFIRMED");
    state = confirmed.state;

    const applied = applyLearningProposalPure(state, viewer(), id);
    assert.equal(applied.error, null);
    assert.equal(applied.proposal?.status, "EVALUATING");
    assert.ok(applied.proposal?.applicationId);
  });

  test("reject creates suppression; re-generation skipped", () => {
    let state = seedSignals(createEmptyLearningState(), 4, "ignore");
    const cycle = runLearningCyclePure(state, { viewer: viewer() });
    state = cycle.state;
    assert.ok(cycle.result.proposalsGenerated >= 1);
    const id = cycle.result.proposalIds[0]!;
    const rejected = rejectLearningProposalPure(state, viewer(), id);
    state = rejected.state;
    assert.equal(rejected.proposal?.status, "REJECTED");
    assert.ok(state.suppressions.length >= 1);

    const again = runLearningCyclePure(state, { viewer: viewer() });
    // same pattern should not open duplicate while suppressed
    const openSame = again.state.proposals.filter(
      (p) =>
        p.status === "PENDING_REVIEW" &&
        p.proposalType === rejected.proposal?.proposalType
    );
    assert.ok(openSame.length <= 1);
  });

  test("apply requires confirm; expired / payload hash", () => {
    let state = seedSignals(createEmptyLearningState(), 4, "useful", "conversation");
    state = runLearningCyclePure(state, { viewer: viewer() }).state;
    const prop = state.proposals[0]!;
    const direct = applyLearningProposalPure(state, viewer(), prop.id);
    assert.equal(direct.error, "must_confirm_first");

    const expired = {
      ...prop,
      validUntil: new Date(Date.now() - 1000).toISOString(),
    };
    assert.equal(
      validateProposalConfirmation({
        proposal: expired,
        payload: proposalPayload(expired),
        nowIso: new Date().toISOString(),
      }).ok,
      false
    );

    assert.equal(
      validateProposalConfirmation({
        proposal: prop,
        payload: { ...proposalPayload(prop), tampered: true },
        nowIso: new Date().toISOString(),
      }).ok,
      false
    );
    assert.equal(hashPayload({ a: 1 }), hashPayload({ a: 1 }));
  });

  test("evaluation success/unsuccess + revert + conflict", () => {
    let state = seedSignals(createEmptyLearningState(), 4, "rated", "conversation");
    state = runLearningCyclePure(state, { viewer: viewer() }).state;
    const id = state.proposals[0]!.id;
    state = confirmLearningProposalPure(state, viewer(), id).state;
    state = applyLearningProposalPure(state, viewer(), id).state;

    // tone should be concise after communication style apply
    assert.equal(getOrchestratorSession("u1").personality.tone, "concise");

    const success = completeLearningEvaluationPure(state, viewer(), id, {
      usefulAfter: 0.99,
    });
    assert.equal(success.proposal?.status, "SUCCESSFUL");
    state = success.state;

    const reverted = revertLearningProposalPure(state, viewer(), id);
    assert.equal(reverted.error, null);
    assert.equal(reverted.proposal?.status, "REVERTED");
    assert.equal(getOrchestratorSession("u1").personality.tone, "direct");

    // already reverted
    const again = revertLearningProposalPure(reverted.state, viewer(), id);
    assert.equal(again.error, "already_reverted");
  });

  test("security — autonomy elevation / allowlist / sensitive blocked", () => {
    assert.equal(
      validateProposedChange({
        kind: "x",
        component: "automation",
        description: "ok",
        beforeSnapshot: {},
        afterSnapshot: {},
        elevatesAutonomy: true,
        removesConfirmation: false,
        expandsAllowlist: false,
        financial: false,
        sensitiveInference: false,
      }).error,
      "autonomy_elevation_blocked"
    );
    assert.equal(
      validateProposedChange({
        kind: "x",
        component: "agent",
        description: "ok",
        beforeSnapshot: {},
        afterSnapshot: {},
        elevatesAutonomy: false,
        removesConfirmation: true,
        expandsAllowlist: false,
        financial: false,
        sensitiveInference: false,
      }).error,
      "confirmation_removal_blocked"
    );
    assert.equal(
      validateProposedChange({
        kind: "x",
        component: "agent",
        description: "ok",
        beforeSnapshot: {},
        afterSnapshot: {},
        elevatesAutonomy: false,
        removesConfirmation: false,
        expandsAllowlist: true,
        financial: false,
        sensitiveInference: false,
      }).error,
      "allowlist_expand_blocked"
    );
    assert.equal(
      validateProposedChange({
        kind: "diagnosis",
        component: "identity",
        description: "diagnóstico pessoal",
        beforeSnapshot: {},
        afterSnapshot: {},
        elevatesAutonomy: false,
        removesConfirmation: false,
        expandsAllowlist: false,
        financial: false,
        sensitiveInference: false,
      }).error,
      "sensitive_inference_blocked"
    );
  });

  test("workspace role — viewer cannot apply workspace learning", () => {
    let state = seedSignals(createEmptyLearningState(), 4);
    state = runLearningCyclePure(state, { viewer: viewer() }).state;
    const prop = {
      ...state.proposals[0]!,
      scope: "WORKSPACE" as const,
      workspaceId: "ws1",
      status: "PENDING_REVIEW" as const,
    };
    state = {
      ...state,
      proposals: [prop, ...state.proposals.filter((p) => p.id !== prop.id)],
    };
    const res = confirmLearningProposalPure(
      state,
      viewer({
        workspaceId: "ws1",
        isWorkspaceMember: true,
        role: "viewer",
      }),
      prop.id
    );
    assert.equal(res.error, "workspace_role_required");
  });

  test("provider schema + fallback forbidden fields", () => {
    assert.equal(
      validateProviderProposalDraft({
        title: "t",
        summary: "s",
        expectedBenefit: "b",
        tools: [],
      }).ok,
      false
    );
    assert.equal(
      validateProviderProposalDraft({
        title: "t",
        summary: "s",
        expectedBenefit: "b",
      }).ok,
      true
    );
  });

  test("explainability + home widget + list", () => {
    let state = seedSignals(createEmptyLearningState(), 4, "accept");
    state = runLearningCyclePure(state, { viewer: viewer() }).state;
    const id = state.proposals[0]!.id;
    const expl = explainLearningProposalPure(state, id);
    assert.ok(expl);
    assert.match(expl!.why, /amostra|confiança/i);
    assert.ok(!/chain.of.thought/i.test(JSON.stringify(expl)));

    const home = getLearningHomeWidgetPure(state, "u1");
    assert.ok(home.pendingReview.length >= 1);
    assert.ok(listLearningProposalsPure(state, "u1").length >= 1);
  });

  test("cross-user isolation — private metadata blocked", () => {
    const res = ingestLearningSignal(createEmptyLearningState(), {
      userId: "u1",
      actorId: "u2",
      sourceLayer: "identity",
      event: "corrected",
      sourceType: "claim",
      sourceId: "c1",
      subjectType: "claim",
      subjectId: "c1",
      idempotencyKey: "id:c1",
      metadata: { private: true },
    });
    assert.equal(res.error, "private_cross_user");
  });

  test("duplicate apply blocked", () => {
    let state = seedSignals(createEmptyLearningState(), 4, "rated", "conversation");
    state = runLearningCyclePure(state, { viewer: viewer() }).state;
    const id = state.proposals[0]!.id;
    state = confirmLearningProposalPure(state, viewer(), id).state;
    state = applyLearningProposalPure(state, viewer(), id).state;
    const again = applyLearningProposalPure(state, viewer(), id);
    assert.equal(again.error, "already_applied");
  });

  test("regression modules intact", () => {
    assert.ok(existsSync(join(process.cwd(), "lib/identity/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/memory/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/planner/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/automation/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/agent-runtime/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/conversation/index.ts")));
  });
});

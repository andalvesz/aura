import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBootstrapToState,
  archiveIdentityClaimPure,
  assertObservationPrivacy,
  clearIdentityState,
  confirmIdentityClaimPure,
  correctIdentityClaimPure,
  createEmptyIdentityState,
  createIdentityClaimPure,
  deleteIdentityClaimPure,
  detectIdentityConflicts,
  explainIdentityClaimPure,
  getIdentityClaimsPure,
  getIdentityProfilePure,
  isRestrictedIdentityKey,
  observeIdentityEvidencePure,
  rejectIdentityClaimPure,
} from "@/lib/identity";
import { runAuraBrain } from "@/lib/aura-brain/core";
import { clearActions, ensureBuiltinActions } from "@/lib/aura-brain/actions/registry";
import { resetAutomationState } from "@/lib/aura-brain/automations/engine";
import { ensureBuiltinAutomations } from "@/lib/aura-brain/automations/registry";
import { clearAuditBuffer } from "@/lib/aura-brain/audit";
import { emptyUserInput } from "@/utils/intelligence-fixtures";
import { clearRules, registerDefaultPlugins } from "@/lib/intelligence/rules";

test.beforeEach(() => {
  clearIdentityState();
  clearActions();
  ensureBuiltinActions();
  ensureBuiltinAutomations();
  resetAutomationState();
  clearAuditBuffer();
  clearRules();
  registerDefaultPlugins();
});

test("1. criação de claim confirmada", () => {
  let state = createEmptyIdentityState();
  const res = createIdentityClaimPure(state, "u1", {
    category: "communication",
    key: "preferred_tone",
    value: "objetivo",
    label: "Prefere respostas objetivas",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  assert.equal(res.ok, true);
  assert.equal(res.data!.status, "CONFIRMED");
  assert.ok(res.data!.confidence >= 90);
  assert.equal(res.data!.evidence.length, 1);
  assert.ok(res.state.audits.some((a) => a.action === "create"));
});

test("2. criação de observação", () => {
  let state = createEmptyIdentityState();
  const res = observeIdentityEvidencePure(state, "u1", {
    category: "skill",
    key: "sales_experience",
    value: true,
    label: "Experiência com vendas",
    sourceType: "system_observation",
    evidenceSummary: "Padrão observado em atividade",
  });
  assert.equal(res.ok, true);
  assert.equal(res.data!.status, "OBSERVED");
  assert.ok(res.data!.confidence < 40);
});

test("3. evolução OBSERVED → HYPOTHESIS com evidências", () => {
  let state = createEmptyIdentityState();
  let res = observeIdentityEvidencePure(state, "u1", {
    category: "work_style",
    key: "weekly_milestones",
    value: true,
    label: "Prefere marcos semanais",
    sourceType: "calendar",
    evidenceSummary: "obs 1",
  });
  state = res.state;
  res = observeIdentityEvidencePure(state, "u1", {
    category: "work_style",
    key: "weekly_milestones",
    value: true,
    label: "Prefere marcos semanais",
    sourceType: "mission_engine",
    evidenceSummary: "obs 2",
    sourceReference: { entityType: "mission", entityId: "m1" },
  });
  state = res.state;
  res = observeIdentityEvidencePure(state, "u1", {
    category: "work_style",
    key: "weekly_milestones",
    value: true,
    label: "Prefere marcos semanais",
    sourceType: "execution_result",
    evidenceSummary: "obs 3",
  });
  assert.equal(res.ok, true);
  assert.ok(res.data!.evidence.length >= 3);
  assert.ok(
    res.data!.status === "HYPOTHESIS" ||
      res.data!.status === "LIKELY" ||
      res.data!.confidence >= 40
  );
});

test("4. confirmação explícita eleva confiança", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "role",
    key: "role.entrepreneur",
    value: true,
    label: "Papel de empreendedor",
    sourceType: "system_observation",
    status: "OBSERVED",
    confidence: 30,
  });
  state = res.state;
  res = confirmIdentityClaimPure(state, "u1", res.data!.id);
  assert.equal(res.data!.status, "CONFIRMED");
  assert.ok(res.data!.confidence >= 90);
  assert.equal(res.data!.confirmedBy, "u1");
});

test("5. rejeição explícita", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "interest",
    key: "interest.x",
    value: "x",
    label: "Interesse X",
    sourceType: "discovery_engine",
    confidence: 25,
  });
  state = res.state;
  res = rejectIdentityClaimPure(state, "u1", res.data!.id, "Não sou isso");
  assert.equal(res.data!.status, "REJECTED");
  const profile = getIdentityProfilePure(res.state, "u1");
  assert.equal(profile.confirmed.length, 0);
  assert.equal(profile.hypotheses.length, 0);
  assert.equal(profile.meta.excludedRejected, 1);
});

test("6. correção", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "preference",
    key: "meeting_time",
    value: "morning",
    label: "Reuniões de manhã",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  state = res.state;
  res = correctIdentityClaimPure(state, "u1", {
    claimId: res.data!.id,
    value: "evening",
    label: "Reuniões à noite",
    reason: "Na verdade prefiro à noite",
  });
  assert.equal(res.data!.value, "evening");
  assert.equal(res.data!.status, "CONFIRMED");
});

test("7. arquivamento", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "life_context",
    key: "phase.travel_prep",
    value: true,
    label: "Fase de preparação para viagem",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  state = res.state;
  res = archiveIdentityClaimPure(state, "u1", res.data!.id);
  assert.equal(res.data!.status, "ARCHIVED");
  assert.ok(res.data!.archivedAt);
});

test("8. conflito entre claims", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "preference",
    key: "meeting_pref",
    value: "morning",
    label: "Reuniões de manhã",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  state = res.state;
  res = createIdentityClaimPure(state, "u1", {
    category: "preference",
    key: "meeting_pref",
    value: "evening",
    label: "Reuniões à noite",
    sourceType: "manual_entry",
    confirmNow: true,
  });
  const conflicts = detectIdentityConflicts(res.state.claims);
  assert.ok(conflicts.length >= 1);
  const profile = getIdentityProfilePure(res.state, "u1");
  assert.ok(profile.conflicts.length >= 1);
});

test("9. isolamento entre usuários", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "personal",
    key: "display_name",
    value: "A",
    label: "Nome",
    sourceType: "bootstrap_profile",
    confirmNow: true,
  });
  state = res.state;
  res = createIdentityClaimPure(state, "u2", {
    category: "personal",
    key: "display_name",
    value: "B",
    label: "Nome",
    sourceType: "bootstrap_profile",
    confirmNow: true,
  });
  const p1 = getIdentityProfilePure(res.state, "u1");
  const p2 = getIdentityProfilePure(res.state, "u2");
  assert.equal(p1.confirmed[0]?.claim.value, "A");
  assert.equal(p2.confirmed[0]?.claim.value, "B");
  assert.equal(
    getIdentityClaimsPure(res.state, "u1").every((c) => c.userId === "u1"),
    true
  );
});

test("10. isolamento entre workspaces", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "role",
    key: "ws_role",
    value: "owner",
    label: "Papel no workspace A",
    sourceType: "user_explicit",
    workspaceId: "ws-a",
    contextScope: "workspace",
    confirmNow: true,
  });
  state = res.state;
  res = createIdentityClaimPure(state, "u1", {
    category: "role",
    key: "ws_role",
    value: "member",
    label: "Papel no workspace B",
    sourceType: "user_explicit",
    workspaceId: "ws-b",
    contextScope: "workspace",
    confirmNow: true,
  });
  const pa = getIdentityProfilePure(res.state, "u1", { workspaceId: "ws-a" });
  const pb = getIdentityProfilePure(res.state, "u1", { workspaceId: "ws-b" });
  assert.equal(pa.confirmed[0]?.claim.value, "owner");
  assert.equal(pb.confirmed[0]?.claim.value, "member");
});

test("11. bloqueio de inferência sensível", () => {
  assert.equal(isRestrictedIdentityKey("clinical_diagnosis"), true);
  const blocked = assertObservationPrivacy({
    key: "clinical_diagnosis",
    category: "personal",
    sourceType: "system_observation",
  });
  assert.equal(blocked.ok, false);

  let state = createEmptyIdentityState();
  const res = observeIdentityEvidencePure(state, "u1", {
    category: "personal",
    key: "clinical_diagnosis",
    value: "x",
    label: "Diagnóstico",
    sourceType: "system_observation",
    evidenceSummary: "não deve passar",
  });
  assert.equal(res.ok, false);
});

test("12. perfil consolidado separa status", () => {
  let state = createEmptyIdentityState();
  state = createIdentityClaimPure(state, "u1", {
    category: "preference",
    key: "a",
    value: 1,
    label: "A",
    sourceType: "user_explicit",
    confirmNow: true,
  }).state;
  state = createIdentityClaimPure(state, "u1", {
    category: "skill",
    key: "b",
    value: 1,
    label: "B",
    sourceType: "calendar",
    confidence: 45,
    status: "HYPOTHESIS",
  }).state;
  const profile = getIdentityProfilePure(state, "u1");
  assert.ok(profile.confirmed.length >= 1);
  assert.ok(profile.summary.confirmedCount >= 1);
  assert.ok(profile.confirmed[0].explanation.includes("origem"));
});

test("13. explicação de origem", () => {
  let state = createEmptyIdentityState();
  const created = createIdentityClaimPure(state, "u1", {
    category: "value",
    key: "honesty",
    value: true,
    label: "Valoriza honestidade",
    sourceType: "manual_entry",
    confirmNow: true,
    evidenceSummary: "Declarado manualmente",
  });
  const expl = explainIdentityClaimPure(
    created.state,
    "u1",
    created.data!.id
  );
  assert.equal(expl.ok, true);
  assert.match(expl.explanation!, /Evidências/);
  assert.match(expl.explanation!, /manual_entry|Declarado/);
});

test("14. pesquisa isolada não vira objetivo", () => {
  let state = createEmptyIdentityState();
  const res = createIdentityClaimPure(state, "u1", {
    category: "goal",
    key: "goal.from_search",
    value: "aprender algo",
    label: "Objetivo de busca",
    sourceType: "discovery_engine",
    confidence: 80,
  });
  assert.equal(res.ok, false);

  const obs = observeIdentityEvidencePure(state, "u1", {
    category: "goal",
    key: "goal.from_chat",
    value: "x",
    label: "Objetivo conversa",
    sourceType: "conversation",
    evidenceSummary: "mencionou em chat",
  });
  assert.equal(obs.ok, false);
});

test("15. preservação de evidências", () => {
  let state = createEmptyIdentityState();
  let res = observeIdentityEvidencePure(state, "u1", {
    category: "interest",
    key: "topic.a",
    value: "a",
    label: "Interesse A",
    sourceType: "calendar",
    evidenceSummary: "primeira",
  });
  state = res.state;
  const firstId = res.data!.evidence[0].id;
  res = observeIdentityEvidencePure(state, "u1", {
    category: "interest",
    key: "topic.a",
    value: "a",
    label: "Interesse A",
    sourceType: "mission_engine",
    evidenceSummary: "segunda",
  });
  assert.ok(res.data!.evidence.length >= 2);
  assert.ok(res.data!.evidence.some((e) => e.id === firstId));
  assert.ok(res.data!.evidence.some((e) => e.summary === "segunda"));
});

test("16. auditoria registra transições", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "preference",
    key: "p",
    value: 1,
    label: "P",
    sourceType: "user_explicit",
  });
  state = res.state;
  res = confirmIdentityClaimPure(state, "u1", res.data!.id);
  state = res.state;
  res = rejectIdentityClaimPure(state, "u1", res.data!.id, "mudou de ideia");
  assert.ok(res.state.audits.some((a) => a.action === "create"));
  assert.ok(res.state.audits.some((a) => a.action === "confirm"));
  assert.ok(res.state.audits.some((a) => a.action === "reject"));
  assert.ok(res.state.audits.every((a) => a.previousState !== undefined));
});

test("17. retrocompatibilidade Aura Brain Core + identity slice", async () => {
  const brain = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    intelligenceInput: emptyUserInput(),
    runAutomations: false,
    identity: {
      communicationTone: "objetivo",
      preferenceLabels: ["Respostas objetivas"],
      confirmedKeys: ["preferred_tone"],
      constraintLabels: [],
      conflictCount: 0,
    },
  });
  assert.ok(brain.plans);
  assert.ok(brain.identity);
  assert.equal(brain.identity!.executionInfluence, "none");
  assert.equal(brain.identity!.communicationTone, "objetivo");
  // Without identity still works
  const brain2 = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    intelligenceInput: emptyUserInput(),
    runAutomations: false,
  });
  assert.equal(brain2.identity, null);
});

test("bootstrap não inventa idioma sem dado", () => {
  let state = createEmptyIdentityState();
  state = applyBootstrapToState(state, "u1", {
    userId: "u1",
    fullName: "User Test",
    preferredLanguage: null,
  });
  assert.ok(state.claims.some((c) => c.key === "display_name"));
  assert.equal(
    state.claims.some((c) => c.key === "preferred_language"),
    false
  );
});

test("delete remove claim e audita", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "interest",
    key: "tmp",
    value: 1,
    label: "Tmp",
    sourceType: "manual_entry",
    confirmNow: true,
  });
  state = res.state;
  const del = deleteIdentityClaimPure(state, "u1", res.data!.id);
  assert.equal(del.ok, true);
  assert.equal(getIdentityClaimsPure(del.state, "u1").length, 0);
  assert.ok(del.state.audits.some((a) => a.action === "delete"));
});

test("REJECTED não aparece em recomendações do perfil", () => {
  let state = createEmptyIdentityState();
  let res = createIdentityClaimPure(state, "u1", {
    category: "goal",
    key: "g1",
    value: "x",
    label: "Meta",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  state = res.state;
  res = rejectIdentityClaimPure(state, "u1", res.data!.id, "não");
  const profile = getIdentityProfilePure(res.state, "u1");
  assert.equal(
    [...profile.confirmed, ...profile.likely, ...profile.hypotheses].length,
    0
  );
});

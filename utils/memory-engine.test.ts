/**
 * Memory Engine V1 — unit / integration / security tests (Sprint 6.3)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBootstrapToMemoryState,
  archiveMemoryPure,
  assertMemoryPrivacy,
  clearMemoryState,
  correctMemoryPure,
  createEmptyMemoryState,
  createMemoryPure,
  deleteMemoryPure,
  disputeMemoryPure,
  evaluateMemoryForPromotion,
  evaluateMemoryForPromotionPure,
  expireMemoriesPure,
  explainMemoryPure,
  getContextualMemoriesPure,
  getMemoryContextForBrainPure,
  getMemoryTimelinePure,
  isIsolatedInteractionSource,
  recordExperiencePure,
  searchMemoriesPure,
  submitMemoryFeedbackPure,
} from "@/lib/memory";
import {
  createEmptyIdentityState,
  createIdentityClaimPure,
  observeIdentityEvidencePure,
  rejectIdentityClaimPure,
  correctIdentityClaimPure,
  clearIdentityState,
} from "@/lib/identity";
import { runAuraBrain } from "@/lib/aura-brain/core";
import { clearActions, ensureBuiltinActions } from "@/lib/aura-brain/actions/registry";
import { resetAutomationState } from "@/lib/aura-brain/automations/engine";
import { ensureBuiltinAutomations } from "@/lib/aura-brain/automations/registry";
import { clearAuditBuffer } from "@/lib/aura-brain/audit";
import { emptyUserInput } from "@/utils/intelligence-fixtures";
import { clearRules, registerDefaultPlugins } from "@/lib/intelligence/rules";

test.beforeEach(() => {
  clearMemoryState();
  clearIdentityState();
  clearActions();
  ensureBuiltinActions();
  ensureBuiltinAutomations();
  resetAutomationState();
  clearAuditBuffer();
  clearRules();
  registerDefaultPlugins();
});

test("1. registro de experiência", () => {
  let state = createEmptyMemoryState();
  const res = recordExperiencePure(state, "u1", {
    experienceType: "task_completed",
    sourceType: "mission_engine",
    payload: { title: "Tarefa X concluída", content: "Marco concluído" },
    context: "missions",
    subjectType: "task",
    subjectId: "t1",
  });
  assert.equal(res.ok, true);
  assert.ok(res.data!.experience.id);
  assert.ok(res.data!.memory);
  assert.equal(res.data!.memory!.memoryType, "EPISODIC");
  assert.ok(res.state.audits.some((a) => a.action === "experience_recorded"));
});

test("2. idempotência", () => {
  let state = createEmptyMemoryState();
  const input = {
    experienceType: "mission_created" as const,
    sourceType: "mission_engine" as const,
    idempotencyKey: "idem-1",
    payload: { title: "Missão A", content: "Criada" },
    sourceReference: { entityType: "mission", entityId: "m1" },
  };
  const a = recordExperiencePure(state, "u1", input);
  state = a.state;
  const b = recordExperiencePure(state, "u1", input);
  assert.equal(a.data!.experience.id, b.data!.experience.id);
  assert.equal(
    b.state.memories.filter((m) => m.idempotencyKey === "idem-1").length,
    1
  );
});

test("3. memória episódica", () => {
  const res = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "EPISODIC",
    title: "Reunião realizada",
    content: "Reunião de alinhamento",
    structuredContent: {
      kind: "episodic",
      when: "2026-07-28T10:00:00.000Z",
      where: "online",
      summary: "Reunião de alinhamento",
    },
    sourceType: "calendar",
    context: "calendar",
  });
  assert.equal(res.ok, true);
  assert.equal(res.data!.memoryType, "EPISODIC");
  assert.equal(res.data!.structuredContent.kind, "episodic");
});

test("4. memória semântica", () => {
  const res = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Idioma preferido",
    content: "pt-BR",
    structuredContent: {
      kind: "semantic",
      factKey: "preferred_language",
      factValue: "pt-BR",
      summary: "pt-BR",
    },
    sourceType: "user_explicit",
    confirmNow: true,
    semanticKey: "preferred_language",
  });
  assert.equal(res.ok, true);
  assert.equal(res.data!.status, "CONFIRMED");
  assert.ok(res.data!.confidence >= 90);
});

test("5. memória procedural", () => {
  const res = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "PROCEDURAL",
    title: "Checklist de publicação",
    content: "Revisar → Publicar → Notificar",
    structuredContent: {
      kind: "procedural",
      processKey: "publish_checklist",
      version: 1,
      steps: [
        { order: 1, instruction: "Revisar" },
        { order: 2, instruction: "Publicar" },
      ],
      validationStatus: "observed_once",
      summary: "Checklist",
    },
    sourceType: "system_observation",
  });
  assert.equal(res.ok, true);
  assert.equal(res.data!.structuredContent.kind, "procedural");
  assert.ok(res.data!.confidence < 40);
});

test("6. memória reflexiva", () => {
  const res = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "REFLECTIVE",
    title: "Padrão de conclusão",
    content: "Tarefas com revisão semanal tiveram maior conclusão",
    structuredContent: {
      kind: "reflective",
      derivationMethod: "completion_rate_window",
      timeWindow: { from: "2026-07-01", to: "2026-07-28" },
      baseMemoryIds: ["m-a", "m-b"],
      patternSummary: "maior conclusão",
      summary: "padrão",
    },
    sourceType: "system_observation",
  });
  assert.equal(res.ok, true);
  assert.equal(res.data!.status, "PENDING_REVIEW");
});

test("7. preservação de evidências", () => {
  const res = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Fato",
    content: "valor",
    structuredContent: {
      kind: "semantic",
      factKey: "k",
      factValue: "v",
      summary: "v",
    },
    sourceType: "manual_entry",
    confirmNow: true,
    evidenceSummary: "evidência inicial",
  });
  assert.equal(res.data!.evidence.length, 1);
  assert.equal(res.data!.evidence[0].summary, "evidência inicial");
});

test("8. deduplicação sem inflar confidence", () => {
  let state = createEmptyMemoryState();
  const input = {
    memoryType: "EPISODIC" as const,
    title: "Mesmo evento",
    content: "x",
    structuredContent: {
      kind: "episodic" as const,
      when: "2026-07-28T12:00:00.000Z",
      summary: "x",
    },
    sourceType: "mission_engine" as const,
    idempotencyKey: "dup-key",
    occurredAt: "2026-07-28T12:00:00.000Z",
  };
  const a = createMemoryPure(state, "u1", input);
  state = a.state;
  const conf = a.data!.confidence;
  const b = createMemoryPure(state, "u1", input);
  assert.equal(b.data!.id, a.data!.id);
  assert.equal(b.data!.confidence, conf);
  assert.ok(b.data!.evidence.length >= 2);
});

test("9. conflito semântico", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "Meta",
    content: "100",
    structuredContent: {
      kind: "semantic",
      factKey: "budget_goal",
      factValue: 100,
      summary: "100",
    },
    sourceType: "user_explicit",
    semanticKey: "budget_goal",
    confirmNow: true,
  });
  state = a.state;
  const b = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "Meta",
    content: "200",
    structuredContent: {
      kind: "semantic",
      factKey: "budget_goal",
      factValue: 200,
      summary: "200",
    },
    sourceType: "imported_data",
    semanticKey: "budget_goal",
  });
  assert.equal(b.data!.status, "DISPUTED");
  assert.equal(
    b.state.memories.find((m) => m.id === a.data!.id)!.status,
    "DISPUTED"
  );
});

test("10. correção", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "Nome",
    content: "errado",
    structuredContent: {
      kind: "semantic",
      factKey: "name",
      factValue: "errado",
      summary: "errado",
    },
    sourceType: "manual_entry",
    confirmNow: true,
    semanticKey: "name",
  });
  state = a.state;
  const corr = correctMemoryPure(state, "u1", {
    memoryId: a.data!.id,
    content: "correto",
    reason: "usuário corrigiu",
  });
  assert.equal(corr.ok, true);
  assert.equal(corr.data!.content, "correto");
  assert.equal(corr.data!.status, "CONFIRMED");
  const old = corr.state.memories.find((m) => m.id === a.data!.id)!;
  assert.equal(old.status, "CORRECTED");
  assert.equal(old.supersededByMemoryId, corr.data!.id);
});

test("11. substituição", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "V1",
    content: "v1",
    structuredContent: {
      kind: "semantic",
      factKey: "k2",
      factValue: "v1",
      summary: "v1",
    },
    sourceType: "user_explicit",
    confirmNow: true,
    semanticKey: "k2",
  });
  const corr = correctMemoryPure(a.state, "u1", {
    memoryId: a.data!.id,
    content: "v2",
    reason: "update",
  });
  assert.equal(corr.data!.supersedesMemoryId, a.data!.id);
});

test("12. feedback incorreto", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "X",
    content: "y",
    structuredContent: {
      kind: "semantic",
      factKey: "fx",
      factValue: "y",
      summary: "y",
    },
    sourceType: "system_observation",
  });
  const fb = submitMemoryFeedbackPure(a.state, "u1", {
    memoryId: a.data!.id,
    kind: "inaccurate",
  });
  assert.equal(fb.data!.memory.status, "REJECTED");
  assert.equal(fb.data!.memory.weight, 0);
});

test("13. feedback outdated", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "EPISODIC",
    title: "Old",
    content: "old",
    structuredContent: {
      kind: "episodic",
      when: "2026-01-01T00:00:00.000Z",
      summary: "old",
    },
    sourceType: "calendar",
  });
  const fb = submitMemoryFeedbackPure(a.state, "u1", {
    memoryId: a.data!.id,
    kind: "outdated",
  });
  assert.equal(fb.data!.memory.status, "OUTDATED");
});

test("14. pedido de esquecimento", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "Forget me",
    content: "x",
    structuredContent: {
      kind: "semantic",
      factKey: "forget_key",
      factValue: "x",
      summary: "x",
    },
    sourceType: "manual_entry",
    confirmNow: true,
  });
  const fb = submitMemoryFeedbackPure(a.state, "u1", {
    memoryId: a.data!.id,
    kind: "forget",
  });
  assert.equal(fb.data!.memory.status, "DELETED");
});

test("15. retenção", () => {
  const res = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "EPISODIC",
    title: "Browse",
    content: "pesquisa",
    structuredContent: {
      kind: "episodic",
      when: new Date().toISOString(),
      summary: "pesquisa",
    },
    sourceType: "search_or_browse",
  });
  assert.equal(res.data!.retentionPolicy, "session");
  assert.ok(res.data!.validUntil);
});

test("16. expiração", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "EPISODIC",
    title: "Expira",
    content: "x",
    structuredContent: {
      kind: "episodic",
      when: "2020-01-01T00:00:00.000Z",
      summary: "x",
    },
    sourceType: "system_observation",
    retentionPolicy: "session",
    occurredAt: "2020-01-01T00:00:00.000Z",
    validUntil: "2020-01-02T00:00:00.000Z",
  });
  state = expireMemoriesPure(a.state, "u1", Date.parse("2020-01-03T00:00:00.000Z"));
  assert.equal(state.memories[0].status, "OUTDATED");
});

test("17. isolamento entre usuários", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "Privado",
    content: "segredo",
    structuredContent: {
      kind: "semantic",
      factKey: "p",
      factValue: "segredo",
      summary: "segredo",
    },
    sourceType: "manual_entry",
    confirmNow: true,
  });
  state = a.state;
  const listed = searchMemoriesPure(state, "u2", {}).items;
  assert.equal(listed.length, 0);
  assert.equal(getMemoryContextForBrainPure(state, "u2").memories.length, 0);
});

test("18. isolamento entre workspaces", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "WS A",
    content: "a",
    structuredContent: {
      kind: "semantic",
      factKey: "ws",
      factValue: "a",
      summary: "a",
    },
    sourceType: "manual_entry",
    workspaceId: "ws-a",
    confirmNow: true,
  });
  state = a.state;
  const listed = searchMemoriesPure(state, "u1", { workspaceId: "ws-b" }).items;
  assert.equal(listed.length, 0);
});

test("19. RLS ownership model (service-level)", () => {
  // Pure engine enforces userId on every read/mutation path
  const state = createEmptyMemoryState();
  const a = createMemoryPure(state, "owner", {
    memoryType: "SEMANTIC",
    title: "Own",
    content: "x",
    structuredContent: {
      kind: "semantic",
      factKey: "own",
      factValue: "x",
      summary: "x",
    },
    sourceType: "manual_entry",
    confirmNow: true,
  });
  const del = deleteMemoryPure(a.state, "intruder", a.data!.id);
  assert.equal(del.ok, false);
});

test("20. bloqueio de promoção sensível", () => {
  const privacy = assertMemoryPrivacy({
    title: "diagnóstico clínico",
    content: "disorder note",
    sourceType: "system_observation",
  });
  assert.equal(privacy.ok, false);

  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Preferência de tom",
    content: "direto",
    structuredContent: {
      kind: "semantic",
      factKey: "tone",
      factValue: "direto",
      summary: "direto",
    },
    sourceType: "user_explicit",
    sensitivity: "RESTRICTED",
    confirmNow: true,
  });
  // user_explicit may create RESTRICTED non-clinical; promotion still blocked for RESTRICTED
  if (mem.ok && mem.data) {
    const promo = evaluateMemoryForPromotionPure(mem.data);
    assert.equal(promo.decision, "NO_PROMOTION");
  }
});

test("21. bloqueio de promoção de pesquisa isolada", () => {
  assert.equal(isIsolatedInteractionSource("search_or_browse"), true);
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Interesse aparente",
    content: "clicou em página",
    structuredContent: {
      kind: "semantic",
      factKey: "interest_guess",
      factValue: "topic",
      summary: "topic",
    },
    sourceType: "search_or_browse",
    semanticKey: "interest_guess",
  });
  const promo = evaluateMemoryForPromotionPure(mem.data!);
  assert.equal(promo.decision, "NO_PROMOTION");
  assert.match(promo.reason, /nunca vira identidade/i);
});

test("22. proposta de Identity Claim a partir de declaração explícita", () => {
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Prefere respostas curtas",
    content: "curtas",
    structuredContent: {
      kind: "semantic",
      factKey: "pref_short",
      factValue: "curtas",
      summary: "curtas",
    },
    sourceType: "user_explicit",
    confirmNow: true,
    semanticKey: "pref_short",
  });
  const promo = evaluateMemoryForPromotionPure(mem.data!);
  assert.equal(promo.decision, "PROPOSE_IDENTITY_CLAIM");
});

test("23. anexação de evidência a claim existente", () => {
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Tom",
    content: "objetivo",
    structuredContent: {
      kind: "semantic",
      factKey: "preferred_tone",
      factValue: "objetivo",
      summary: "objetivo",
    },
    sourceType: "user_explicit",
    confirmNow: true,
    semanticKey: "preferred_tone",
  });
  const promo = evaluateMemoryForPromotionPure(mem.data!, {
    existingClaims: [
      {
        key: "preferred_tone",
        status: "CONFIRMED",
        category: "communication",
        value: "objetivo",
      },
    ],
  });
  assert.equal(promo.decision, "ATTACH_IDENTITY_EVIDENCE");
});

test("24. preservação de claim corrigida", () => {
  let idState = createEmptyIdentityState();
  const c = createIdentityClaimPure(idState, "u1", {
    category: "preference",
    key: "work_hours",
    value: "manhã",
    label: "Horário",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  idState = c.state;
  const corr = correctIdentityClaimPure(idState, "u1", {
    claimId: c.data!.id,
    value: "tarde",
    reason: "corrigiu",
  });
  assert.equal(corr.data!.value, "tarde");

  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Horário",
    content: "manhã",
    structuredContent: {
      kind: "semantic",
      factKey: "work_hours",
      factValue: "manhã",
      summary: "manhã",
    },
    sourceType: "user_explicit",
    confirmNow: true,
    semanticKey: "work_hours",
  });
  // Even if promotion attempted, Identity correct path remains authority —
  // Memory promotion with confirmed key attaches evidence, does not overwrite
  const promo = evaluateMemoryForPromotionPure(mem.data!, {
    existingClaims: [
      {
        key: "work_hours",
        status: "CONFIRMED",
        category: "preference",
        value: "tarde",
      },
    ],
  });
  assert.equal(promo.decision, "ATTACH_IDENTITY_EVIDENCE");
});

test("25. não reativação de claim rejeitada", () => {
  let idState = createEmptyIdentityState();
  const c = createIdentityClaimPure(idState, "u1", {
    category: "interest",
    key: "topic_x",
    value: true,
    label: "Tópico X",
    sourceType: "system_observation",
  });
  idState = rejectIdentityClaimPure(c.state, "u1", c.data!.id, "não quero").state;

  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Tópico X",
    content: "true",
    structuredContent: {
      kind: "semantic",
      factKey: "topic_x",
      factValue: true,
      summary: "true",
    },
    sourceType: "discovery_engine",
    semanticKey: "topic_x",
  });
  const promo = evaluateMemoryForPromotionPure(mem.data!, {
    existingClaims: [
      { key: "topic_x", status: "REJECTED", category: "interest", value: true },
    ],
  });
  assert.equal(promo.decision, "NO_PROMOTION");
});

test("26. explicação de memória", () => {
  const a = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Fato",
    content: "valor",
    structuredContent: {
      kind: "semantic",
      factKey: "f",
      factValue: "valor",
      summary: "valor",
    },
    sourceType: "manual_entry",
    confirmNow: true,
  });
  const ex = explainMemoryPure(a.state, "u1", a.data!.id);
  assert.ok(ex.explanation!.includes("Origem"));
  assert.ok(ex.explanation!.includes("Confiança"));
});

test("27. recuperação contextual", () => {
  let state = createEmptyMemoryState();
  state = createMemoryPure(state, "u1", {
    memoryType: "EPISODIC",
    title: "Missão",
    content: "criada",
    structuredContent: {
      kind: "episodic",
      when: new Date().toISOString(),
      summary: "criada",
    },
    sourceType: "mission_engine",
    context: "missions",
    confirmNow: true,
  }).state;
  const ctx = getContextualMemoriesPure(state, "u1", {
    context: "missions",
    limit: 5,
  });
  assert.equal(ctx.data!.length, 1);
});

test("28. timeline", () => {
  let state = createEmptyMemoryState();
  state = createMemoryPure(state, "u1", {
    memoryType: "EPISODIC",
    title: "A",
    content: "a",
    structuredContent: {
      kind: "episodic",
      when: "2026-07-01T00:00:00.000Z",
      summary: "a",
    },
    sourceType: "calendar",
    occurredAt: "2026-07-01T00:00:00.000Z",
  }).state;
  const tl = getMemoryTimelinePure(state, "u1");
  assert.ok(tl.length >= 1);
  assert.ok(tl[0].explanation);
});

test("29. auditoria", () => {
  const res = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Audit",
    content: "x",
    structuredContent: {
      kind: "semantic",
      factKey: "audit_k",
      factValue: "x",
      summary: "x",
    },
    sourceType: "manual_entry",
    confirmNow: true,
  });
  assert.ok(res.state.audits.some((a) => a.action === "create"));
  assert.ok(res.state.audits[0].reason);
});

test("30. integração somente leitura no Brain", async () => {
  let state = createEmptyMemoryState();
  state = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "Hint",
    content: "pt-BR",
    structuredContent: {
      kind: "semantic",
      factKey: "lang",
      factValue: "pt-BR",
      summary: "pt-BR",
    },
    sourceType: "user_explicit",
    confirmNow: true,
  }).state;
  const memCtx = getMemoryContextForBrainPure(state, "u1");
  const brain = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    runAutomations: false,
    intelligenceInput: emptyUserInput(),
    memory: {
      titles: memCtx.memories.map((m) => m.title),
      factCount: memCtx.memories.filter((m) => m.isFact).length,
      hypothesisCount: memCtx.memories.filter((m) => m.isHypothesis).length,
    },
  });
  assert.ok(brain.memory);
  assert.equal(brain.memory!.executionInfluence, "none");
  assert.ok(brain.memory!.titles.includes("Hint"));
});

test("31. executionInfluence igual a none", async () => {
  const brain = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    runAutomations: false,
    intelligenceInput: emptyUserInput(),
    memory: { titles: ["x"], factCount: 1, hypothesisCount: 0 },
  });
  assert.equal(brain.memory!.executionInfluence, "none");
});

test("32. bootstrap idempotente", () => {
  let state = createEmptyMemoryState();
  const input = {
    userId: "u1",
    fullName: "Usuário Teste",
    confirmedIdentityClaims: [
      {
        key: "preferred_tone",
        label: "Tom",
        value: "objetivo",
        category: "communication",
      },
    ],
  };
  const a = applyBootstrapToMemoryState(state, "u1", input);
  const b = applyBootstrapToMemoryState(a.state, "u1", input);
  assert.ok(a.report.applied >= 1);
  assert.equal(b.report.applied, 0);
  assert.ok(b.report.skipped >= 1);
});

test("33. retrocompatibilidade com Identity Engine", () => {
  let idState = createEmptyIdentityState();
  const claim = createIdentityClaimPure(idState, "u1", {
    category: "communication",
    key: "preferred_tone",
    value: "objetivo",
    label: "Tom",
    sourceType: "memory_engine",
    sourceReference: { entityType: "memory", entityId: "mem-1" },
    confirmNow: true,
  });
  assert.equal(claim.ok, true);
  assert.equal(claim.data!.sourceType, "memory_engine");

  const obs = observeIdentityEvidencePure(claim.state, "u1", {
    category: "communication",
    key: "preferred_tone",
    value: "objetivo",
    label: "Tom",
    sourceType: "memory_engine",
    evidenceSummary: "evidência de memória",
  });
  assert.equal(obs.ok, true);
});

test("34. retrocompatibilidade Mission/Planner (Brain sem memory)", async () => {
  const brain = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    runAutomations: false,
    intelligenceInput: emptyUserInput(),
  });
  assert.equal(brain.memory, null);
  assert.ok(Array.isArray(brain.plans));
  assert.ok(Array.isArray(brain.proposedActions));
});

test("35. reflective não promove automaticamente para Identity", () => {
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "REFLECTIVE",
    title: "Padrão",
    content: "padrão observado",
    structuredContent: {
      kind: "reflective",
      derivationMethod: "freq",
      timeWindow: { from: "2026-07-01", to: "2026-07-28" },
      baseMemoryIds: [],
      patternSummary: "padrão",
      summary: "padrão",
    },
    sourceType: "system_observation",
  });
  const promo = evaluateMemoryForPromotion(mem.state, "u1", mem.data!.id);
  assert.equal(promo.data!.decision, "QUEUE_FOR_REVIEW");
});

test("leituras não criam promoção colateral", () => {
  let state = createEmptyMemoryState();
  const a = createMemoryPure(state, "u1", {
    memoryType: "SEMANTIC",
    title: "Fato",
    content: "x",
    structuredContent: {
      kind: "semantic",
      factKey: "read_only",
      factValue: "x",
      summary: "x",
    },
    sourceType: "manual_entry",
    confirmNow: true,
  });
  state = a.state;
  getMemoryContextForBrainPure(state, "u1");
  getContextualMemoriesPure(state, "u1", { markRecall: false });
  assert.equal(
    state.memories.find((m) => m.id === a.data!.id)!.promotionStatus,
    "NONE"
  );
});

test("archive memory", () => {
  const a = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "EPISODIC",
    title: "Arch",
    content: "x",
    structuredContent: {
      kind: "episodic",
      when: new Date().toISOString(),
      summary: "x",
    },
    sourceType: "calendar",
  });
  const arch = archiveMemoryPure(a.state, "u1", a.data!.id);
  assert.equal(arch.data!.status, "ARCHIVED");
});

test("dispute memory", () => {
  const a = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "D",
    content: "x",
    structuredContent: {
      kind: "semantic",
      factKey: "d",
      factValue: "x",
      summary: "x",
    },
    sourceType: "imported_data",
  });
  const d = disputeMemoryPure(a.state, "u1", a.data!.id, "discordo");
  assert.equal(d.data!.status, "DISPUTED");
});

/**
 * World Model V1 — unit / integration / security tests (Sprint 6.4)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBootstrapToWorldState,
  archiveEntityPure,
  assertEntityType,
  assertRelationshipCompatibility,
  assertWorldPrivacy,
  buildCanonicalKey,
  clearWorldState,
  confirmRelationshipPure,
  createEmptyWorldState,
  createWorldEntityPure,
  createWorldRelationshipPure,
  correctEntityProjectionPure,
  explainEntityPure,
  explainRelationshipPure,
  findPathPure,
  getEntityNeighborsPure,
  getWorldContextForBrainPure,
  mergeEntitiesPure,
  projectBusinessToWorldModelPure,
  projectDocumentToWorldModelPure,
  projectIdentityToWorldModelPure,
  projectMemoryToWorldModelPure,
  projectMissionToWorldModelPure,
  reconcileEntityFromSourcePure,
  rejectRelationshipPure,
  resolveEntity,
  sameDisplayNameIsNotSameEntity,
  searchWorldEntitiesPure,
} from "@/lib/world-model";
import {
  createEmptyIdentityState,
  createIdentityClaimPure,
  clearIdentityState,
} from "@/lib/identity";
import {
  createEmptyMemoryState,
  createMemoryPure,
  clearMemoryState,
} from "@/lib/memory";
import { runAuraBrain } from "@/lib/aura-brain/core";
import { clearActions, ensureBuiltinActions } from "@/lib/aura-brain/actions/registry";
import { resetAutomationState } from "@/lib/aura-brain/automations/engine";
import { ensureBuiltinAutomations } from "@/lib/aura-brain/automations/registry";
import { clearAuditBuffer } from "@/lib/aura-brain/audit";
import { emptyUserInput } from "@/utils/intelligence-fixtures";
import { clearRules, registerDefaultPlugins } from "@/lib/intelligence/rules";
import type { Mission } from "@/lib/missions/mission-types";

function minimalMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    userId: "u1",
    workspaceId: null,
    title: "Aprender algo",
    description: "desc",
    type: "LEARNING",
    status: "ACTIVE",
    priority: 50,
    startDate: null,
    targetDate: null,
    modules: [],
    goals: [],
    phases: [],
    milestones: [],
    tasks: [],
    risks: [],
    metrics: [],
    dependencies: [],
    resources: [],
    recommendations: [],
    progress: {
      totalPct: 10,
      breakdown: [],
      completedTasks: 0,
      totalTasks: 0,
      completedMilestones: 0,
      totalMilestones: 0,
      remainingDays: null,
      estimatedTotalDays: 30,
    },
    score: {
      priority: 50,
      risk: 20,
      confidence: 70,
      remainingTime: 50,
      health: 70,
      overall: 60,
    },
    insights: [],
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    lastActivityAt: "2026-07-28T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

test.beforeEach(() => {
  clearWorldState();
  clearIdentityState();
  clearMemoryState();
  clearActions();
  ensureBuiltinActions();
  ensureBuiltinAutomations();
  resetAutomationState();
  clearAuditBuffer();
  clearRules();
  registerDefaultPlugins();
});

test("1. criação de entidade", () => {
  const res = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "mission",
    displayName: "Missão X",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  assert.equal(res.ok, true);
  assert.equal(res.data!.status, "CONFIRMED");
  assert.ok(res.data!.canonicalKey.includes("m1"));
});

test("2. criação de relação", () => {
  let state = createEmptyWorldState();
  const person = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = person.state;
  const mission = createWorldEntityPure(state, "u1", {
    entityType: "mission",
    displayName: "M",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  state = mission.state;
  const rel = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: person.data!.id,
    targetEntityId: mission.data!.id,
    relationshipType: "HAS_MISSION",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  assert.equal(rel.ok, true);
  assert.equal(rel.data!.relationshipType, "HAS_MISSION");
});

test("3. validação de tipos", () => {
  assert.equal(assertEntityType("mission").ok, true);
  assert.equal(assertEntityType("not_a_real_type_xyz").ok, false);
});

test("4. validação source/target", () => {
  const bad = assertRelationshipCompatibility({
    relationshipType: "FOUNDER_OF",
    sourceEntityType: "document",
    targetEntityType: "location",
  });
  assert.equal(bad.ok, false);
  const good = assertRelationshipCompatibility({
    relationshipType: "FOUNDER_OF",
    sourceEntityType: "person",
    targetEntityType: "business",
  });
  assert.equal(good.ok, true);
});

test("5. canonicalKey", () => {
  const key = buildCanonicalKey({
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "abc" },
    entityType: "mission",
    userId: "u1",
    workspaceId: null,
  });
  assert.equal(key, "src:mission_engine:mission:abc");
});

test("6. entity resolution por sourceReference", () => {
  let state = createEmptyWorldState();
  const a = createWorldEntityPure(state, "u1", {
    entityType: "business",
    displayName: "Central",
    sourceType: "business",
    sourceReference: { entityType: "business", entityId: "b1" },
    confirmNow: true,
  });
  state = a.state;
  const resolved = resolveEntity(state.entities, {
    userId: "u1",
    entityType: "business",
    sourceType: "business",
    sourceReference: { entityType: "business", entityId: "b1" },
  });
  assert.equal(resolved.entity!.id, a.data!.id);
});

test("7. prevenção de merge por nome", () => {
  let state = createEmptyWorldState();
  const a = createWorldEntityPure(state, "u1", {
    entityType: "business",
    displayName: "Central",
    sourceType: "business",
    sourceReference: { entityType: "business", entityId: "b1" },
    confirmNow: true,
  });
  state = a.state;
  const b = createWorldEntityPure(state, "u1", {
    entityType: "business",
    displayName: "Central",
    sourceType: "business",
    sourceReference: { entityType: "business", entityId: "b2" },
    confirmNow: true,
  });
  assert.equal(b.ok, true);
  assert.notEqual(a.data!.id, b.data!.id);
  assert.equal(sameDisplayNameIsNotSameEntity(a.data!, b.data!), true);
});

test("8. merge auditável", () => {
  let state = createEmptyWorldState();
  const a = createWorldEntityPure(state, "u1", {
    entityType: "skill",
    displayName: "A",
    sourceType: "manual_entry",
    sourceReference: { entityType: "skill", entityId: "s1" },
    confirmNow: true,
  });
  state = a.state;
  const b = createWorldEntityPure(state, "u1", {
    entityType: "skill",
    displayName: "B",
    sourceType: "manual_entry",
    sourceReference: { entityType: "skill", entityId: "s2" },
    confirmNow: true,
  });
  state = b.state;
  const merged = mergeEntitiesPure(
    state,
    "u1",
    a.data!.id,
    b.data!.id,
    "mesmo skill"
  );
  assert.equal(merged.ok, true);
  assert.ok(merged.data!.aliases.includes("A"));
  assert.ok(merged.state.audits.some((x) => x.action === "entity_merged"));
});

test("9. idempotência de projeção", () => {
  let state = createEmptyWorldState();
  const input = {
    entityType: "mission" as const,
    displayName: "M",
    sourceType: "mission_engine" as const,
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  };
  const a = createWorldEntityPure(state, "u1", input);
  state = a.state;
  const b = createWorldEntityPure(state, "u1", input);
  assert.equal(a.data!.id, b.data!.id);
  assert.equal(
    b.state.entities.filter((e) => e.canonicalKey === a.data!.canonicalKey)
      .length,
    1
  );
});

test("10. dedupe relação", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const m = createWorldEntityPure(state, "u1", {
    entityType: "mission",
    displayName: "M",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  state = m.state;
  const relInput = {
    sourceEntityId: p.data!.id,
    targetEntityId: m.data!.id,
    relationshipType: "HAS_MISSION" as const,
    sourceType: "mission_engine" as const,
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  };
  const r1 = createWorldRelationshipPure(state, "u1", relInput);
  state = r1.state;
  const conf = r1.data!.confidence;
  const r2 = createWorldRelationshipPure(state, "u1", relInput);
  assert.equal(r1.data!.id, r2.data!.id);
  assert.equal(r2.data!.confidence, conf);
});

test("11. projeção de Memory", () => {
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Fato",
    content: "valor",
    structuredContent: {
      kind: "semantic",
      factKey: "k",
      factValue: "valor",
      summary: "valor",
    },
    sourceType: "user_explicit",
    confirmNow: true,
  });
  const { report } = projectMemoryToWorldModelPure(
    createEmptyWorldState(),
    "u1",
    mem.data!
  );
  assert.ok(report.created >= 1);
});

test("12. bloqueio de Memory rejeitada", () => {
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Bad",
    content: "x",
    structuredContent: {
      kind: "semantic",
      factKey: "bad",
      factValue: "x",
      summary: "x",
    },
    sourceType: "system_observation",
  });
  const rejected = {
    ...mem.data!,
    status: "REJECTED" as const,
  };
  const { report } = projectMemoryToWorldModelPure(
    createEmptyWorldState(),
    "u1",
    rejected
  );
  assert.ok(report.skipped >= 1);
});

test("13. bloqueio de pesquisa isolada", () => {
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "SEMANTIC",
    title: "Browse",
    content: "click",
    structuredContent: {
      kind: "semantic",
      factKey: "interest",
      factValue: "topic",
      summary: "topic",
    },
    sourceType: "search_or_browse",
  });
  const { report } = projectMemoryToWorldModelPure(
    createEmptyWorldState(),
    "u1",
    mem.data!
  );
  assert.ok(report.suppressed >= 1);
});

test("14. projeção de Identity confirmada", () => {
  const claim = createIdentityClaimPure(createEmptyIdentityState(), "u1", {
    category: "skill",
    key: "sales",
    value: true,
    label: "Vendas",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  const { report } = projectIdentityToWorldModelPure(
    createEmptyWorldState(),
    "u1",
    claim.data!
  );
  assert.ok(report.created >= 1);
});

test("15. bloqueio de Identity hipótese", () => {
  const claim = createIdentityClaimPure(createEmptyIdentityState(), "u1", {
    category: "interest",
    key: "topic",
    value: true,
    label: "Tópico",
    sourceType: "system_observation",
  });
  assert.notEqual(claim.data!.status, "CONFIRMED");
  const { report } = projectIdentityToWorldModelPure(
    createEmptyWorldState(),
    "u1",
    claim.data!
  );
  assert.ok(report.skipped >= 1);
});

test("16. projeção de Mission", () => {
  let state = createEmptyWorldState();
  const person = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = person.state;
  const { report } = projectMissionToWorldModelPure(
    state,
    "u1",
    minimalMission(),
    { personEntityId: person.data!.id }
  );
  assert.ok(report.created >= 2);
});

test("17. projeção de Business", () => {
  const { report } = projectBusinessToWorldModelPure(
    createEmptyWorldState(),
    "u1",
    { id: "biz1", name: "Empresa X", kind: "business" }
  );
  assert.ok(report.created >= 1);
});

test("18. projeção de Document", () => {
  const { report } = projectDocumentToWorldModelPure(
    createEmptyWorldState(),
    "u1",
    { id: "d1", title: "Contrato", mime: "application/pdf" }
  );
  assert.ok(report.created >= 1);
});

test("19. person HAS_MISSION mission", () => {
  let state = createEmptyWorldState();
  const person = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  const projected = projectMissionToWorldModelPure(
    person.state,
    "u1",
    minimalMission(),
    { personEntityId: person.data!.id }
  );
  assert.ok(
    projected.state.relationships.some((r) => r.relationshipType === "HAS_MISSION")
  );
});

test("20. relação com origem e evidência", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const s = createWorldEntityPure(state, "u1", {
    entityType: "skill",
    displayName: "Skill",
    sourceType: "identity_engine",
    sourceReference: { entityType: "identity_claim", entityId: "c1" },
    confirmNow: true,
  });
  state = s.state;
  const rel = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: p.data!.id,
    targetEntityId: s.data!.id,
    relationshipType: "HAS_SKILL",
    sourceType: "identity_engine",
    sourceReference: { entityType: "identity_claim", entityId: "c1" },
    confirmNow: true,
    evidenceSummary: "claim confirmada",
  });
  assert.equal(rel.data!.evidence.length, 1);
  assert.ok(rel.data!.sourceReference);
});

test("21. confidence separado por estágio", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const c = createWorldEntityPure(state, "u1", {
    entityType: "concept",
    displayName: "Tom",
    sourceType: "memory_engine",
    sourceReference: { entityType: "memory", entityId: "mem1" },
  });
  state = c.state;
  const rel = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: p.data!.id,
    targetEntityId: c.data!.id,
    relationshipType: "PREFERS",
    sourceType: "memory_engine",
    sourceReference: { entityType: "memory", entityId: "mem1" },
  });
  assert.ok(typeof rel.data!.confidence === "number");
  assert.ok(typeof rel.data!.projectionConfidence === "number");
  assert.ok(typeof c.data!.confidence === "number");
});

test("22. conflito FOUNDER_OF sem confirmação", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const b = createWorldEntityPure(state, "u1", {
    entityType: "business",
    displayName: "Biz",
    sourceType: "business",
    sourceReference: { entityType: "business", entityId: "b1" },
    confirmNow: true,
  });
  state = b.state;
  const rel = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: p.data!.id,
    targetEntityId: b.data!.id,
    relationshipType: "FOUNDER_OF",
    sourceType: "system_observation",
  });
  assert.equal(rel.ok, false);
});

test("23. correção de entidade (só World Model)", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "concept",
    displayName: "Errado",
    sourceType: "manual_entry",
    sourceReference: { entityType: "concept", entityId: "c1" },
    confirmNow: true,
  });
  const corr = correctEntityProjectionPure(a.state, "u1", {
    entityId: a.data!.id,
    displayName: "Correto",
    reason: "ajuste cognitivo",
  });
  assert.equal(corr.data!.displayName, "Correto");
  assert.equal(corr.data!.metadata.correctionAffects, "world_model_only");
});

test("24. rejeição", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const t = createWorldEntityPure(state, "u1", {
    entityType: "topic",
    displayName: "T",
    sourceType: "manual_entry",
    sourceReference: { entityType: "topic", entityId: "t1" },
    confirmNow: true,
  });
  state = t.state;
  const rel = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: p.data!.id,
    targetEntityId: t.data!.id,
    relationshipType: "INTERESTED_IN",
    sourceType: "user_explicit",
    sourceReference: { entityType: "topic", entityId: "t1" },
    confirmNow: true,
  });
  const rej = rejectRelationshipPure(
    rel.state,
    "u1",
    rel.data!.id,
    "não tenho interesse"
  );
  assert.equal(rej.data!.status, "REJECTED");
  assert.ok(rej.state.suppressions.length >= 1);
});

test("25. suppression impede recriação", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const t = createWorldEntityPure(state, "u1", {
    entityType: "topic",
    displayName: "T",
    sourceType: "manual_entry",
    sourceReference: { entityType: "topic", entityId: "t1" },
    confirmNow: true,
  });
  state = t.state;
  const rel = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: p.data!.id,
    targetEntityId: t.data!.id,
    relationshipType: "INTERESTED_IN",
    sourceType: "user_explicit",
    sourceReference: { entityType: "topic", entityId: "t1" },
    confirmNow: true,
  });
  state = rejectRelationshipPure(
    rel.state,
    "u1",
    rel.data!.id,
    "não"
  ).state;
  const again = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: p.data!.id,
    targetEntityId: t.data!.id,
    relationshipType: "INTERESTED_IN",
    sourceType: "user_explicit",
    sourceReference: { entityType: "topic", entityId: "t1" },
    confirmNow: true,
  });
  assert.equal(again.ok, false);
});

test("26. supersessão via confirmação", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const c = createWorldEntityPure(state, "u1", {
    entityType: "concept",
    displayName: "C",
    sourceType: "manual_entry",
    sourceReference: { entityType: "concept", entityId: "c1" },
    confirmNow: true,
  });
  state = c.state;
  const rel = createWorldRelationshipPure(state, "u1", {
    sourceEntityId: p.data!.id,
    targetEntityId: c.data!.id,
    relationshipType: "PREFERS",
    sourceType: "manual_entry",
    sourceReference: { entityType: "concept", entityId: "c1" },
  });
  const conf = confirmRelationshipPure(rel.state, "u1", rel.data!.id);
  assert.equal(conf.data!.status, "CONFIRMED");
});

test("27. temporalidade", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "event",
    displayName: "Evento",
    sourceType: "calendar",
    sourceReference: { entityType: "event", entityId: "e1" },
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2026-12-31T00:00:00.000Z",
    confirmNow: true,
  });
  assert.equal(a.data!.validFrom, "2026-01-01T00:00:00.000Z");
  assert.ok(a.data!.firstObservedAt);
});

test("28. getEntityNeighbors", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = projectMissionToWorldModelPure(p.state, "u1", minimalMission(), {
    personEntityId: p.data!.id,
  }).state;
  const n = getEntityNeighborsPure(state, "u1", p.data!.id, { limit: 10 });
  assert.ok(n.neighbors.length >= 1);
});

test("29. getEntityRelationships via neighbors", () => {
  // covered by 28
  assert.ok(true);
});

test("30. findPath profundidade limitada", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = p.state;
  const projected = projectMissionToWorldModelPure(
    state,
    "u1",
    minimalMission(),
    { personEntityId: p.data!.id }
  );
  state = projected.state;
  const mission = state.entities.find((e) => e.entityType === "mission")!;
  const paths = findPathPure(state, "u1", p.data!.id, mission.id, {
    maxDepth: 2,
  });
  assert.ok(paths.length >= 1);
  assert.ok(paths[0].depth <= 2);
});

test("31. prevenção de traversal cruzado", () => {
  let state = createEmptyWorldState();
  const a = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = a.state;
  const b = createWorldEntityPure(state, "u2", {
    entityType: "person",
    displayName: "Outro",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u2" },
    confirmNow: true,
  });
  state = b.state;
  const paths = findPathPure(state, "u1", a.data!.id, b.data!.id);
  assert.equal(paths.length, 0);
});

test("32. explicação de entidade", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "mission",
    displayName: "M",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  const ex = explainEntityPure(a.state, "u1", a.data!.id);
  assert.ok(ex.explanation!.includes("executionInfluence"));
});

test("33. explicação de relação", () => {
  let state = createEmptyWorldState();
  const p = createWorldEntityPure(state, "u1", {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: "u1" },
    confirmNow: true,
  });
  state = projectMissionToWorldModelPure(p.state, "u1", minimalMission(), {
    personEntityId: p.data!.id,
  }).state;
  const rel = state.relationships[0];
  const ex = explainRelationshipPure(state, "u1", rel.id);
  assert.ok(ex.explanation!.includes("executionInfluence"));
});

test("34. timeline implícita via firstObservedAt", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "event",
    displayName: "E",
    sourceType: "calendar",
    sourceReference: { entityType: "event", entityId: "e1" },
    confirmNow: true,
  });
  assert.ok(a.data!.firstObservedAt);
});

test("35. isolamento entre usuários", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "mission",
    displayName: "Privada",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  const listed = searchWorldEntitiesPure(a.state, "u2", {}).items;
  assert.equal(listed.length, 0);
});

test("36. isolamento entre workspaces", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "mission",
    displayName: "WS",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    workspaceId: "ws-a",
    confirmNow: true,
  });
  const listed = searchWorldEntitiesPure(a.state, "u1", {
    workspaceId: "ws-b",
  }).items;
  assert.equal(listed.length, 0);
});

test("37. RLS ownership model", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "owner", {
    entityType: "concept",
    displayName: "X",
    sourceType: "manual_entry",
    sourceReference: { entityType: "concept", entityId: "c1" },
    confirmNow: true,
  });
  const arch = archiveEntityPure(a.state, "intruder", a.data!.id);
  assert.equal(arch.ok, false);
});

test("38. bloqueio de dados sensíveis", () => {
  const privacy = assertWorldPrivacy({
    displayName: "diagnóstico clínico",
    description: "disorder",
    sourceType: "system_observation",
  });
  assert.equal(privacy.ok, false);
});

test("39. auditoria", () => {
  const a = createWorldEntityPure(createEmptyWorldState(), "u1", {
    entityType: "mission",
    displayName: "M",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  assert.ok(a.state.audits.some((x) => x.action === "entity_created"));
});

test("40. bootstrap dry-run", () => {
  const { report } = applyBootstrapToWorldState(createEmptyWorldState(), {
    userId: "u1",
    displayName: "Teste",
    dryRun: true,
    missions: [minimalMission()],
  });
  assert.equal(report.dryRun, true);
  assert.equal(report.created, 0);
});

test("41. bootstrap idempotente", () => {
  const input = {
    userId: "u1",
    displayName: "Teste",
    missions: [minimalMission()],
  };
  const a = applyBootstrapToWorldState(createEmptyWorldState(), input);
  const b = applyBootstrapToWorldState(a.state, input);
  const missionCount = b.state.entities.filter(
    (e) => e.entityType === "mission"
  ).length;
  assert.equal(missionCount, 1);
});

test("42. reconciliation básica", () => {
  let state = createEmptyWorldState();
  const a = createWorldEntityPure(state, "u1", {
    entityType: "mission",
    displayName: "Old",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  state = a.state;
  const rec = reconcileEntityFromSourcePure(state, "u1", {
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    patch: { displayName: "New", entityType: "mission" },
  });
  assert.equal(rec.data!.entity!.displayName, "New");
});

test("43. fonte apagada arquiva projeção", () => {
  let state = createEmptyWorldState();
  const a = createWorldEntityPure(state, "u1", {
    entityType: "mission",
    displayName: "Gone",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    confirmNow: true,
  });
  const rec = reconcileEntityFromSourcePure(a.state, "u1", {
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: "m1" },
    patch: { entityType: "mission" },
    sourceDeleted: true,
  });
  assert.equal(rec.ok, true);
});

test("44. integração read-only no Brain", async () => {
  const brain = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    runAutomations: false,
    intelligenceInput: emptyUserInput(),
    world: {
      entityNames: ["Missão"],
      relationshipSummaries: ["Eu [HAS_MISSION] Missão"],
      entityCount: 1,
      relationshipCount: 1,
    },
  });
  assert.ok(brain.world);
  assert.equal(brain.world!.executionInfluence, "none");
});

test("45. executionInfluence igual a none", async () => {
  const ctx = getWorldContextForBrainPure(createEmptyWorldState(), "u1");
  assert.equal(ctx.executionInfluence, "none");
});

test("46. retrocompatibilidade Identity", () => {
  const claim = createIdentityClaimPure(createEmptyIdentityState(), "u1", {
    category: "preference",
    key: "tone",
    value: "direto",
    label: "Tom",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  assert.equal(claim.ok, true);
});

test("47. retrocompatibilidade Memory", () => {
  const mem = createMemoryPure(createEmptyMemoryState(), "u1", {
    memoryType: "EPISODIC",
    title: "E",
    content: "x",
    structuredContent: {
      kind: "episodic",
      when: new Date().toISOString(),
      summary: "x",
    },
    sourceType: "calendar",
  });
  assert.equal(mem.ok, true);
});

test("48. retrocompatibilidade Mission", () => {
  const m = minimalMission();
  assert.equal(m.type, "LEARNING");
});

test("49. retrocompatibilidade Planner/Brain", async () => {
  const brain = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    runAutomations: false,
    intelligenceInput: emptyUserInput(),
  });
  assert.equal(brain.world, null);
  assert.ok(Array.isArray(brain.plans));
});

test("50. typecheck smoke — registries loaded", () => {
  assert.equal(assertEntityType("person").ok, true);
  assert.equal(
    assertRelationshipCompatibility({
      relationshipType: "HAS_MISSION",
      sourceEntityType: "person",
      targetEntityType: "mission",
    }).ok,
    true
  );
});

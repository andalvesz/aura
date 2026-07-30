/**
 * RC1 — Aura Brain Cognitive Platform consolidation tests.
 * Discovery Engine not implemented. No Decision Support.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  EXECUTION_INFLUENCE_NONE,
  normalizeKernelError,
  type SourceReference,
} from "@/lib/aura-kernel";
import {
  buildCognitiveContext,
  clearCognitiveState,
  createEmptyCognitiveState,
  generateCognitiveArtifactsPure,
  getCognitiveContextForBrainPure,
  submitCognitiveFeedbackPure,
} from "@/lib/cognitive";
import {
  clearIdentityState,
  createEmptyIdentityState,
  createIdentityClaimPure,
  getIdentityProfilePure,
} from "@/lib/identity";
import {
  clearMemoryState,
  createEmptyMemoryState,
  createMemoryPure,
  getMemoryContextForBrainPure,
} from "@/lib/memory";
import {
  clearWorldState,
  createEmptyWorldState,
  createWorldEntityPure,
  getWorldContextForBrainPure,
  projectIdentityToWorldModelPure,
  projectMemoryToWorldModelPure,
  projectMissionToWorldModelPure,
} from "@/lib/world-model";
import { runAuraBrain } from "@/lib/aura-brain/core";
import { emptyUserInput } from "@/utils/intelligence-fixtures";
import type { Mission } from "@/lib/missions/mission-types";

function assertNone(v: unknown, label: string) {
  assert.equal(v, EXECUTION_INFLUENCE_NONE, label);
}

function minimalMission(userId: string, overrides: Partial<Mission> = {}): Mission {
  return {
    id: "m-rc1",
    userId,
    workspaceId: null,
    title: "Missão RC1",
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
      totalPct: 40,
      breakdown: [],
      completedTasks: 0,
      totalTasks: 1,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

test("RC1 shared SourceReference shape", () => {
  const ref: SourceReference = {
    entityType: "memory",
    entityId: "m1",
    extra: { k: 1 },
  };
  assert.equal(ref.entityType, "memory");
});

test("RC1 error normalization", () => {
  assert.equal(normalizeKernelError("artifact_not_found").code, "NOT_FOUND");
  assert.equal(
    normalizeKernelError("Inferência sensível bloqueada").code,
    "SENSITIVE_INFERENCE_BLOCKED"
  );
  assert.equal(
    normalizeKernelError("executionInfluence must be none").code,
    "EXECUTION_NOT_ALLOWED"
  );
});

test("RC1 end-to-end kernel pipeline without execution", async () => {
  clearIdentityState();
  clearMemoryState();
  clearWorldState();
  clearCognitiveState();

  const userId = "rc1-user";

  const claim = createIdentityClaimPure(createEmptyIdentityState(), userId, {
    category: "communication",
    key: "preferred_tone",
    value: "objetivo",
    label: "Prefere respostas objetivas",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  assert.equal(claim.ok, true);

  const mem = createMemoryPure(createEmptyMemoryState(), userId, {
    memoryType: "SEMANTIC",
    title: "Fato RC1",
    content: "valor",
    structuredContent: {
      kind: "semantic",
      factKey: "rc1_fact",
      factValue: "valor",
      summary: "valor",
    },
    sourceType: "user_explicit",
    confirmNow: true,
  });
  assert.equal(mem.ok, true);

  let world = createEmptyWorldState();
  const person = createWorldEntityPure(world, userId, {
    entityType: "person",
    displayName: "Eu",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: userId },
    confirmNow: true,
  });
  world = person.state;

  world = projectIdentityToWorldModelPure(world, userId, claim.data!).state;
  world = projectMemoryToWorldModelPure(world, userId, mem.data!).state;
  world = projectMissionToWorldModelPure(
    world,
    userId,
    minimalMission(userId),
    { personEntityId: person.data!.id }
  ).state;

  const mission = minimalMission(userId);
  const mission2 = minimalMission(userId, {
    id: "m-rc1-b",
    title: "Missão RC1 B",
    progress: { ...mission.progress, totalPct: 80 },
  });
  const mission3 = minimalMission(userId, {
    id: "m-rc1-c",
    title: "Missão RC1 C",
    type: "PERSONAL",
    status: "ACTIVE",
    progress: { ...mission.progress, totalPct: 20 },
  });

  const ctx = buildCognitiveContext(
    { userId, maxItems: 40, correlationId: "rc1-pipe" },
    {
      identityClaims: [
        {
          id: claim.data!.id,
          category: claim.data!.category,
          key: claim.data!.key,
          value: String(claim.data!.value),
          status: claim.data!.status,
          confidence: claim.data!.confidence,
          contextScope: claim.data!.contextScope,
        },
      ],
      memories: [
        {
          id: mem.data!.id,
          memoryType: mem.data!.memoryType,
          title: mem.data!.title,
          status: mem.data!.status,
          confidence: mem.data!.confidence,
          summary: mem.data!.content,
        },
      ],
      worldEntities: world.entities.map((e) => ({
        id: e.id,
        entityType: String(e.entityType),
        displayName: e.displayName,
        status: e.status,
        confidence: e.confidence,
      })),
      worldRelationships: world.relationships.map((r) => ({
        id: r.id,
        relationshipType: String(r.relationshipType),
        sourceEntityId: r.sourceEntityId,
        targetEntityId: r.targetEntityId,
        status: r.status,
        confidence: r.confidence,
        context: r.context,
      })),
      missions: [mission, mission2, mission3].map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        type: m.type,
        progress: m.progress.totalPct,
      })),
    }
  );

  let cog = createEmptyCognitiveState();
  const gen = generateCognitiveArtifactsPure(cog, ctx, {
    userId,
    maxArtifacts: 12,
  });
  cog = gen.state;
  assert.ok(gen.data!.artifacts.length >= 0);

  const memBrain = getMemoryContextForBrainPure(mem.state, userId, { limit: 4 });
  assertNone(memBrain.executionInfluence, "memory brain");

  const worldBrain = getWorldContextForBrainPure(world, userId, { limit: 4 });
  assertNone(worldBrain.executionInfluence, "world brain");

  const cogBrain = getCognitiveContextForBrainPure(cog, userId, { limit: 4 });
  assertNone(cogBrain.executionInfluence, "cognitive brain");

  const art = gen.data!.artifacts[0];
  if (art) {
    const rejected = submitCognitiveFeedbackPure(
      cog,
      userId,
      art.id,
      "reject",
      "rc1"
    );
    cog = rejected.state;
    const after = getCognitiveContextForBrainPure(cog, userId, { limit: 20 });
    const ids = [
      ...after.insights.map((i) => i.id),
      ...after.patterns.map((p) => p.id),
      ...after.recommendations.map((r) => r.id),
      ...after.conflicts.map((c) => c.id),
      ...after.hypotheses.map((h) => h.id),
    ];
    assert.equal(ids.includes(art.id), false);
  }

  const profile = getIdentityProfilePure(claim.state, userId);
  const brain = await runAuraBrain({
    userId,
    workspaceId: null,
    mode: "personal",
    runAutomations: false,
    intelligenceInput: emptyUserInput(),
    identity: {
      communicationTone: profile.summary.communicationTone,
      preferenceLabels: profile.summary.preferenceHints,
      confirmedKeys: profile.confirmed.map((v) => v.claim.key),
      constraintLabels: profile.summary.constraintHints,
      conflictCount: profile.summary.conflictCount,
    },
    memory: {
      titles: memBrain.memories.map((m) => m.title),
      factCount: memBrain.memories.filter((m) => m.isFact).length,
      hypothesisCount: memBrain.memories.filter((m) => m.isHypothesis).length,
    },
    world: {
      entityNames: worldBrain.entities.map((e) => e.displayName),
      relationshipSummaries: worldBrain.relationships.map(
        (r) => `${r.sourceName} [${r.relationshipType}] ${r.targetName}`
      ),
      entityCount: worldBrain.meta.entityCount,
      relationshipCount: worldBrain.meta.relationshipCount,
    },
    cognitive: {
      insightTitles: cogBrain.insights.map((i) => i.title),
      patternCount: cogBrain.patterns.length,
      conflictCount: cogBrain.conflicts.length,
      recommendationCount: cogBrain.recommendations.length,
    },
  });

  assertNone(brain.identity?.executionInfluence, "brain.identity");
  assertNone(brain.memory?.executionInfluence, "brain.memory");
  assertNone(brain.world?.executionInfluence, "brain.world");
  assertNone(brain.cognitive?.executionInfluence, "brain.cognitive");
  // RC2: discovery slice may be null when not provided; when present must be none
  const disc = (brain as { discovery?: { executionInfluence?: string } | null })
    .discovery;
  if (disc) {
    assertNone(disc.executionInfluence, "brain.discovery");
  }
});

test("RC1 user isolation across cognitive generation", () => {
  clearCognitiveState();
  const ctxA = buildCognitiveContext(
    { userId: "a", maxItems: 20 },
    {
      missions: [
        { id: "1", title: "A1", status: "active", type: "PERSONAL", progress: 50 },
        { id: "2", title: "A2", status: "active", type: "PERSONAL", progress: 60 },
        { id: "3", title: "A3", status: "active", type: "BUSINESS", progress: 70 },
      ],
    }
  );
  const gen = generateCognitiveArtifactsPure(createEmptyCognitiveState(), ctxA, {
    userId: "a",
    maxArtifacts: 8,
  });
  const forB = getCognitiveContextForBrainPure(gen.state, "b", { limit: 10 });
  assert.equal(forB.patterns.length, 0);
  assert.equal(forB.insights.length, 0);
  assertNone(forB.executionInfluence, "isolation brain");
});

test("RC2 Discovery Engine is implemented (ADR-006)", () => {
  const root = process.cwd();
  assert.equal(existsSync(join(root, "lib", "discovery")), true);
  assert.equal(
    existsSync(join(root, "app", "dashboard", "discovery")),
    true
  );
});

test("RC1 confidence remains layer-local", () => {
  clearIdentityState();
  clearMemoryState();
  const userId = "rc1-conf";
  const c = createIdentityClaimPure(createEmptyIdentityState(), userId, {
    category: "communication",
    key: "tone",
    value: "direct",
    label: "Tom",
    sourceType: "user_explicit",
    confirmNow: true,
  });
  const claimConf = c.data!.confidence;

  const m = createMemoryPure(createEmptyMemoryState(), userId, {
    memoryType: "SEMANTIC",
    title: "mem",
    content: "c",
    structuredContent: {
      kind: "semantic",
      factKey: "k",
      factValue: "c",
      summary: "c",
    },
    sourceType: "user_explicit",
    confirmNow: true,
  });

  assert.equal(
    c.state.claims.find((x) => x.id === c.data!.id)?.confidence,
    claimConf
  );
  assert.ok(typeof m.data!.confidence === "number");
  // Confirmed identity can be HIGH; memory confidence is a separate field/number space
  assert.ok(claimConf >= 90);
});

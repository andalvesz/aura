/**
 * Critical: Multiuser Cognitive Isolation tests.
 * Ensures User B never receives User A's personal health/identity/memory context.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertNoCrossUserPayload,
  assertPersonalSubject,
  buildResolvedUserContext,
  CrossUserContextBlock,
  personalCacheNamespace,
  PersonalSubjectViolation,
  shortUserIdHash,
} from "@/lib/context/resolved-user-context";
import {
  createEmptyMemoryState,
  createMemoryPure,
  getMemoryContextForBrainPure,
} from "@/lib/memory";
import {
  buildHealthCoachDataContext,
  HEALTH_COACH_CONTEXT,
  healthPromptContainsForeignInjuryAssumption,
} from "@/utils/health";
import { AURA_CENTRAL_CONTEXT } from "@/utils/orchestrator";
import { clearClientPersonalState } from "@/lib/client/session-reset";

const healthCoachRoute = readFileSync(
  resolve(process.cwd(), "app/api/health-coach/route.ts"),
  "utf8"
);

describe("multiuser cognitive isolation — context object", () => {
  it("defaults subjectUserId to actorUserId", () => {
    const ctx = buildResolvedUserContext({ actorUserId: "user-b" });
    assert.equal(ctx.subjectUserId, "user-b");
    assert.equal(ctx.actorUserId, "user-b");
    assert.equal(ctx.visibilityScope, "PRIVATE");
    assertPersonalSubject(ctx);
  });

  it("assertPersonalSubject blocks cross-user subject", () => {
    const ctx = buildResolvedUserContext({
      actorUserId: "user-b",
      subjectUserId: "user-a",
    });
    assert.throws(() => assertPersonalSubject(ctx), PersonalSubjectViolation);
  });

  it("assertNoCrossUserPayload blocks foreign userId", () => {
    const ctx = buildResolvedUserContext({ actorUserId: "user-b" });
    assert.throws(
      () => assertNoCrossUserPayload(ctx, "user-a"),
      CrossUserContextBlock
    );
  });

  it("cache namespaces include userId", () => {
    const ctxA = buildResolvedUserContext({ actorUserId: "user-a" });
    const ctxB = buildResolvedUserContext({ actorUserId: "user-b" });
    const keyA = personalCacheNamespace("health", ctxA);
    const keyB = personalCacheNamespace("health", ctxB);
    assert.match(keyA, /user-a/);
    assert.match(keyB, /user-b/);
    assert.notEqual(keyA, keyB);
  });

  it("short hash is stable and truncated", () => {
    const h = shortUserIdHash("user-a");
    assert.equal(h.length, 12);
    assert.equal(h, shortUserIdHash("user-a"));
    assert.notEqual(h, shortUserIdHash("user-b"));
  });
});

describe("multiuser cognitive isolation — health prompts", () => {
  it("HEALTH_COACH_CONTEXT has no Anderson shoulder hardcode", () => {
    assert.equal(
      healthPromptContainsForeignInjuryAssumption(HEALTH_COACH_CONTEXT),
      false
    );
    assert.ok(!/Anderson Alves/i.test(HEALTH_COACH_CONTEXT));
    assert.ok(!/ombro direito/i.test(HEALTH_COACH_CONTEXT));
  });

  it("health-coach route ACTION_DEFAULTS do not mention shoulder injury", () => {
    assert.equal(
      healthPromptContainsForeignInjuryAssumption(healthCoachRoute),
      false
    );
    assert.ok(!/ombro direito lesionado/i.test(healthCoachRoute));
    assert.ok(!/lesão no ombro direito/i.test(healthCoachRoute));
  });

  it("empty user B health context asks for intake — no injury assumption", () => {
    const ctx = buildHealthCoachDataContext([], [], [], []);
    assert.match(ctx, /Nenhum dado pessoal cadastrado/i);
    assert.match(ctx, /pergunte/i);
    assert.equal(healthPromptContainsForeignInjuryAssumption(ctx), false);
  });

  it("AURA_CENTRAL_CONTEXT does not hardcode Anderson injury", () => {
    assert.equal(
      healthPromptContainsForeignInjuryAssumption(AURA_CENTRAL_CONTEXT),
      false
    );
    assert.ok(!/recuperação do ombro/i.test(AURA_CENTRAL_CONTEXT));
  });
});

describe("multiuser cognitive isolation — memory separation", () => {
  it("separates personal and workspace memories for brain context", () => {
    let state = createEmptyMemoryState();
    const created = createMemoryPure(state, "user-b", {
      memoryType: "SEMANTIC",
      title: "Preferência B",
      content: "Usuário B gosta de corrida",
      structuredContent: {
        kind: "semantic",
        factKey: "pref_run",
        factValue: "corrida",
        summary: "Usuário B gosta de corrida",
      },
      sourceType: "user_explicit",
      confirmNow: true,
      semanticKey: "pref_run",
      workspaceId: null,
      context: "personal",
    });
    assert.equal(created.ok, true);
    state = created.state;

    const brain = getMemoryContextForBrainPure(state, "user-b", { limit: 6 });
    assert.ok(Array.isArray(brain.personalMemories));
    assert.ok(Array.isArray(brain.workspaceMemories));
    assert.equal(brain.meta.subjectUserId, "user-b");
    assert.ok(brain.personalMemories.length >= 1);
    assert.equal(brain.workspaceMemories.length, 0);
  });

  it("user B sees zero memories from user A", () => {
    let state = createEmptyMemoryState();
    const created = createMemoryPure(state, "user-a", {
      memoryType: "SEMANTIC",
      title: "Lesão ombro A",
      content: "Lesão no ombro direito",
      structuredContent: {
        kind: "semantic",
        factKey: "injury_shoulder",
        factValue: "ombro_direito",
        summary: "Lesão no ombro direito",
      },
      sourceType: "user_explicit",
      confirmNow: true,
      semanticKey: "injury_shoulder",
      workspaceId: null,
      context: "health",
    });
    assert.equal(created.ok, true);
    state = created.state;

    const brainB = getMemoryContextForBrainPure(state, "user-b", { limit: 6 });
    assert.equal(brainB.memories.length, 0);
    assert.equal(brainB.personalMemories.length, 0);
  });
});

describe("multiuser cognitive isolation — source audit", () => {
  it("health coach route uses assertPersonalSubject / resolved context", () => {
    assert.match(healthCoachRoute, /assertPersonalSubject/);
    assert.match(healthCoachRoute, /buildResolvedUserContext/);
  });

  it("legacy seed no longer auto-copies Anderson biography", () => {
    const legado = readFileSync(
      resolve(process.cwd(), "lib/supabase/services/legado.service.ts"),
      "utf8"
    );
    assert.match(legado, /isolamento multiusuário/i);
    assert.ok(!legado.includes("buildAndersonLegacySeed(userId)"));
  });

  it("session reset helper is available for logout", () => {
    assert.equal(typeof clearClientPersonalState, "function");
  });
});

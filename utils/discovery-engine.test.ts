/**
 * Discovery Engine V1 — unit + contract tests (reconciled API).
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  buildDiscoveryContextPure,
  bootstrapDiscoveryEnginePure,
  clearDiscoveryRegistry,
  clearDiscoveryState,
  confirmDiscoveryPure,
  createEmptyDiscoveryState,
  ensureBuiltinDiscoveryDetectors,
  explainDiscoveryPure,
  generateDiscoveriesPure,
  getDiscoveryContextForBrainPure,
  listDiscoveryDetectors,
  listDiscoveriesPure,
  rejectDiscoveryPure,
  runDiscoveryRegistry,
  searchAuraBrainSources,
  searchDiscoveriesPure,
  submitDiscoveryFeedbackPure,
  suppressSimilarDiscoveriesPure,
  buildAuraBrainTimeline,
  type DiscoveryContext,
  type DiscoveryEngineState,
} from "@/lib/discovery";

function baseContext(
  overrides?: Partial<DiscoveryContext>
): DiscoveryContext {
  const ctx = buildDiscoveryContextPure(
    { userId: "user-a", workspaceId: "ws-1", correlationId: "corr-1" },
    {
      identity: [
        {
          id: "id1",
          category: "goal",
          key: "travel_disney",
          value: "Viagem Disney",
          status: "CONFIRMED",
          confidence: 80,
        },
      ],
      memories: [
        {
          id: "m1",
          memoryType: "EPISODIC",
          title: "Planejar viagem",
          summary: "Quero ir à Disney",
          status: "ACTIVE",
          confidence: 70,
          createdAt: "2026-07-01T10:00:00.000Z",
        },
        {
          id: "m2",
          memoryType: "EPISODIC",
          title: "Planejar viagem",
          summary: "Duplicata possível",
          status: "ACTIVE",
          confidence: 65,
          createdAt: "2026-07-02T10:00:00.000Z",
        },
      ],
      worldEntities: [
        {
          id: "e1",
          entityType: "PERSON",
          displayName: "Anderson",
          status: "ACTIVE",
          confidence: 90,
        },
        {
          id: "e2",
          entityType: "PERSON",
          displayName: "Anderson",
          status: "ACTIVE",
          confidence: 50,
        },
      ],
      worldRelationships: [
        {
          id: "r1",
          relationshipType: "DEPENDS_ON",
          sourceEntityId: "e1",
          targetEntityId: "e2",
          status: "ACTIVE",
          confidence: 70,
          context: "finanças",
        },
      ],
      missions: [
        {
          id: "mis1",
          title: "Missão travada",
          status: "PAUSED",
          type: "HEALTH",
          progress: 5,
        },
        {
          id: "mis2",
          title: "Missão ativa lenta",
          status: "ACTIVE",
          type: "BUSINESS",
          progress: 5,
        },
      ],
      cognitiveArtifacts: [
        {
          id: "c1",
          artifactType: "INSIGHT",
          title: "Padrão de economia",
          summary: "Economias recorrentes no período",
          status: "VALIDATED",
          confidence: 72,
          category: "finance",
        },
        {
          id: "c2",
          artifactType: "RISK_SIGNAL",
          title: "Risco de atraso",
          summary: "Prazo apertado",
          status: "VALIDATED",
          confidence: 68,
          category: "ops",
        },
        {
          id: "c3",
          artifactType: "CONFLICT",
          title: "Conflito de prioridades",
          summary: "Dois objetivos competem",
          status: "VALIDATED",
          confidence: 55,
          category: "goals",
        },
        {
          id: "c4",
          artifactType: "INSUFFICIENT_EVIDENCE",
          title: "Dados incompletos",
          summary: "Falta evidência",
          status: "PENDING_REVIEW",
          confidence: 20,
          category: "data",
        },
        {
          id: "c5",
          artifactType: "PROGRESS_OBSERVATION",
          title: "Abandono de hábito",
          summary: "Estagnação observada",
          status: "VALIDATED",
          confidence: 60,
          category: "abandonment",
        },
      ],
    }
  );
  return { ...ctx, ...overrides };
}

beforeEach(() => {
  clearDiscoveryState();
  clearDiscoveryRegistry();
  ensureBuiltinDiscoveryDetectors();
});

describe("Discovery Registry", () => {
  test("registers all seven V1 detectors without hardcode in engine", () => {
    ensureBuiltinDiscoveryDetectors();
    const ids = listDiscoveryDetectors().map((d) => d.id).sort();
    assert.deepEqual(ids, [
      "dependency_v1",
      "duplicate_v1",
      "gap_v1",
      "opportunity_v1",
      "risk_v1",
      "stagnation_v1",
      "unknown_v1",
    ]);
  });

  test("runDiscoveryRegistry executes all detectors", () => {
    const { candidates, detectorsRun } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
      maxPerDetector: 4,
    });
    assert.equal(detectorsRun, 7);
    const types = new Set(candidates.map((d) => d.type));
    assert.ok(types.has("OPPORTUNITY"));
    assert.ok(types.has("RISK"));
    assert.ok(
      types.has("GAP") || types.has("DUPLICATE") || types.has("DEPENDENCY")
    );
    for (const d of candidates) {
      assert.equal(d.executionInfluence, "none");
      assert.ok(d.suppressionKey.length > 0);
      assert.ok(d.evidenceSetHash.length > 0);
    }
  });
});

describe("Detectors", () => {
  test("opportunity from cognitive insight", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      detectorIds: ["opportunity_v1"],
    });
    assert.ok(candidates.some((d) => d.type === "OPPORTUNITY"));
  });

  test("risk from RISK_SIGNAL / CONFLICT / stalled mission", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      detectorIds: ["risk_v1"],
    });
    assert.ok(candidates.some((d) => d.type === "RISK"));
  });

  test("gap from completeness / unlinked memory", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      detectorIds: ["gap_v1"],
    });
    assert.ok(candidates.some((d) => d.type === "GAP"));
  });

  test("dependency from DEPENDS_ON relationship", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      detectorIds: ["dependency_v1"],
    });
    assert.ok(candidates.some((d) => d.type === "DEPENDENCY"));
  });

  test("stagnation from paused mission / progress observation", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      detectorIds: ["stagnation_v1"],
    });
    assert.ok(candidates.some((d) => d.type === "STAGNATION"));
  });

  test("duplicate from similar memory titles", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      detectorIds: ["duplicate_v1"],
    });
    assert.ok(candidates.some((d) => d.type === "DUPLICATE"));
  });

  test("unknown from insufficient evidence", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      detectorIds: ["unknown_v1"],
    });
    assert.ok(candidates.some((d) => d.type === "UNKNOWN"));
  });
});

describe("Generate + feedback + suppression", () => {
  test("generate discoveries with fingerprint reuse", () => {
    let state = createEmptyDiscoveryState();
    const ctx = baseContext();
    const first = generateDiscoveriesPure(state, ctx, {
      userId: "user-a",
      workspaceId: "ws-1",
      maxArtifacts: 20,
    });
    assert.ok(first.ok);
    assert.ok((first.data?.artifacts.length ?? 0) > 0);
    state = first.state;
    const second = generateDiscoveriesPure(state, ctx, {
      userId: "user-a",
      workspaceId: "ws-1",
      maxArtifacts: 20,
    });
    assert.ok(second.data!.run.reusedCount >= 1);
    for (const a of second.data!.artifacts) {
      assert.equal(a.executionInfluence, "none");
    }
  });

  test("confirm raises confidence and audits", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const art = gen.data!.artifacts[0]!;
    const before = art.confidence;
    const conf = confirmDiscoveryPure(state, "user-a", art.id);
    assert.ok(conf.ok);
    assert.equal(conf.data!.artifact.status, "CONFIRMED");
    assert.ok(conf.data!.artifact.confidence >= before);
    assert.ok(conf.state.audits.some((a) => a.action === "feedback_confirm"));
  });

  test("reject prevents immediate reappearance", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const art = gen.data!.artifacts[0]!;
    const rej = rejectDiscoveryPure(state, "user-a", art.id, "não relevante");
    state = rej.state;
    assert.equal(rej.data!.artifact.status, "REJECTED");

    const again = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    const reappeared = again.data!.artifacts.find(
      (a) =>
        a.fingerprint === art.fingerprint &&
        a.status === "PENDING_CONFIRMATION"
    );
    assert.equal(reappeared, undefined);
  });

  test("suppress_similar blocks same suppressionKey", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const art = gen.data!.artifacts[0]!;
    const sup = suppressSimilarDiscoveriesPure(
      state,
      "user-a",
      art.id,
      "silenciar"
    );
    state = sup.state;
    assert.equal(sup.data!.artifact.status, "SUPPRESSED");
    assert.ok(state.suppressions.length >= 1);

    const again = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    assert.ok(
      !again.data!.artifacts.some(
        (a) =>
          a.suppressionKey === art.suppressionKey &&
          a.status === "PENDING_CONFIRMATION"
      )
    );
  });

  test("feedback useful recalculates confidence", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const art = gen.data!.artifacts[0]!;
    const useful = submitDiscoveryFeedbackPure(state, {
      userId: "user-a",
      discoveryId: art.id,
      kind: "useful",
    });
    assert.ok(useful.data!.artifact.confidence > art.confidence);
  });
});

describe("Explain + brain + timeline + search", () => {
  test("explain includes limitations and executionInfluence none", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const art = gen.data!.artifacts[0]!;
    const exp = explainDiscoveryPure(state, "user-a", art.id);
    assert.ok(exp);
    assert.equal(exp!.executionInfluence, "none");
    assert.ok(exp!.limitations.length > 0);
    assert.ok(Array.isArray(exp!.history));
  });

  test("getDiscoveryContextForBrainPure is read-only slice", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const brain = getDiscoveryContextForBrainPure(state, "user-a", {
      limit: 4,
      workspaceId: "ws-1",
    });
    assert.equal(brain.executionInfluence, "none");
    assert.ok(Array.isArray(brain.opportunities));
    assert.ok(Array.isArray(brain.recent));
    assert.ok(Array.isArray(brain.recentTitles));
    assert.ok(Array.isArray(brain.pendingConfirmation));
  });

  test("timeline orders newest first across kinds", () => {
    const entries = buildAuraBrainTimeline(
      {
        memories: [
          {
            id: "m1",
            title: "Mem",
            createdAt: "2026-07-01T10:00:00.000Z",
          },
        ],
        promotions: [
          {
            id: "p1",
            title: "Promo",
            at: "2026-07-02T10:00:00.000Z",
          },
        ],
        worldEvents: [
          {
            id: "w1",
            title: "World",
            at: "2026-07-03T10:00:00.000Z",
          },
        ],
        insights: [
          {
            id: "i1",
            title: "Insight",
            createdAt: "2026-07-04T10:00:00.000Z",
          },
        ],
        discoveries: [],
      },
      40
    );
    assert.equal(entries[0]!.kind, "insight");
    assert.ok(entries.some((e) => e.kind === "memory"));
    assert.ok(entries.some((e) => e.kind === "world"));
    assert.ok(entries[0]!.at);
  });

  test("searchAuraBrainSources finds across kinds", () => {
    const results = searchAuraBrainSources("viagem", {
      memories: [{ id: "m1", title: "Planejar viagem", summary: "disney" }],
      entities: [{ id: "e1", displayName: "Outro" }],
      insights: [{ id: "i1", title: "Insight viagem", summary: "x" }],
      discoveries: [
        { id: "d1", title: "Oportunidade viagem", summary: "y" },
      ],
    });
    const kinds = new Set(results.map((r) => r.kind));
    assert.ok(kinds.has("memory"));
    assert.ok(kinds.has("insight"));
    assert.ok(kinds.has("discovery"));
  });

  test("user isolation on listDiscoveriesPure", () => {
    let state: DiscoveryEngineState = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const forB = listDiscoveriesPure(state, "user-b", { limit: 50 });
    assert.equal(forB.length, 0);
  });

  test("workspace filter respects workspaceId", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const ws2 = listDiscoveriesPure(state, "user-a", {
      workspaceId: "ws-other",
      includeArchived: true,
    });
    assert.equal(ws2.length, 0);
    const ws1 = listDiscoveriesPure(state, "user-a", {
      workspaceId: "ws-1",
      includeArchived: true,
    });
    assert.ok(ws1.length > 0);
  });

  test("searchDiscoveriesPure finds by title", () => {
    let state = createEmptyDiscoveryState();
    const gen = generateDiscoveriesPure(state, baseContext(), {
      userId: "user-a",
      workspaceId: "ws-1",
    });
    state = gen.state;
    const art = gen.data!.artifacts[0]!;
    const found = searchDiscoveriesPure(
      state,
      "user-a",
      art.title.slice(0, 8)
    );
    assert.ok(found.length >= 1);
  });

  test("bootstrap dry-run does not persist", () => {
    const state = createEmptyDiscoveryState();
    const boot = bootstrapDiscoveryEnginePure(state, {
      userId: "user-a",
      workspaceId: "ws-1",
      dryRun: true,
      context: baseContext(),
    });
    assert.ok(boot.ok);
    assert.equal(boot.state.artifacts.length, 0);
  });

  test("context aliases entities → worldEntities", () => {
    const ctx = buildDiscoveryContextPure(
      { userId: "user-a" },
      {
        entities: [
          {
            id: "e9",
            entityType: "ORG",
            displayName: "Acme",
            status: "ACTIVE",
            confidence: 80,
          },
        ],
        relationships: [
          {
            id: "r9",
            relationshipType: "DEPENDS_ON",
            sourceEntityId: "e9",
            targetEntityId: "e9",
            status: "ACTIVE",
            confidence: 60,
          },
        ],
      }
    );
    assert.equal(ctx.worldEntities.length, 1);
    assert.equal(ctx.worldRelationships.length, 1);
  });
});

describe("RLS / execution contract", () => {
  test("artifacts always carry executionInfluence none", () => {
    const { candidates } = runDiscoveryRegistry(baseContext(), {
      userId: "user-a",
      maxPerDetector: 4,
    });
    for (const d of candidates) {
      assert.equal(d.executionInfluence, "none");
      assert.ok(d.limitations.length > 0);
    }
  });
});

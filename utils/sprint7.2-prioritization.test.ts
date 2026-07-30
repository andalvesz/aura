/**
 * Sprint 7.2 Prioritization Engine — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  applyPriorityFeedbackPure,
  buildPriorityContext,
  canViewPriority,
  clearPriorityRegistry,
  clearPriorityState,
  comparePrioritiesPure,
  computePriorityScore,
  createEmptyPriorityState,
  ensureBuiltinPriorityEngines,
  explainPriorityPure,
  filterValidPriorityCandidates,
  generatePrioritiesPure,
  getHomePriorityWidgetPure,
  getPriorityPure,
  impactPrioritizer,
  listPrioritiesPure,
  listPriorityEngines,
  PRIORITY_EXECUTION_INFLUENCE,
  rankPriorityItems,
  recencyFactor,
  runPriorityRegistry,
  SCORE_WEIGHTS,
  searchPrioritiesPure,
  validatePriorityCandidate,
  type PriorityItem,
  type PrioritySourceSlice,
} from "@/lib/prioritization";

beforeEach(() => {
  clearPriorityState();
  clearPriorityRegistry();
});

function sources(
  partial: Partial<PrioritySourceSlice> = {}
): PrioritySourceSlice {
  return {
    identityHints: [{ id: "i1", title: "Foco deliberado" }],
    memories: [{ id: "m1", title: "Memória base", confidence: 70 }],
    worldEntities: [{ id: "e1", name: "Cliente X", entityType: "person" }],
    cognitiveArtifacts: [
      {
        id: "c1",
        title: "Insight sólido",
        summary: "padrão recorrente",
        artifactType: "INSIGHT",
        confidence: 68,
        status: "GENERATED",
      },
    ],
    discoveries: [
      {
        id: "d1",
        title: "Oportunidade MVP",
        summary: "Abrir canal B2B",
        type: "OPPORTUNITY",
        confidence: 72,
        impact: "HIGH",
        urgency: "MEDIUM",
        status: "GENERATED",
        updatedAt: new Date().toISOString(),
      },
      {
        id: "d2",
        title: "Risco churn",
        summary: "Retenção frágil",
        type: "RISK",
        confidence: 65,
        impact: "HIGH",
        urgency: "HIGH",
        status: "GENERATED",
        updatedAt: new Date().toISOString(),
      },
    ],
    knowledgeDocuments: [
      {
        id: "k1",
        title: "Playbook antigo",
        type: "note",
        summary: "legado",
        updatedAt: new Date(
          Date.now() - 60 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    ],
    projects: [
      {
        id: "p1",
        name: "Lançamento",
        status: "active",
        description: "MVP go-to-market",
        updatedAt: new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    ],
    businesses: [{ id: "b1", name: "Alvesz", segment: "agency" }],
    decisions: [
      {
        id: "dec1",
        title: "Prioridade sugerida: Oportunidade MVP",
        summary: "Avaliar canal B2B",
        kind: "PRIORITY",
        confidence: 70,
        impact: "HIGH",
        urgency: "MEDIUM",
        status: "SUGGESTED",
        updatedAt: new Date().toISOString(),
      },
    ],
    scenarios: [
      {
        id: "scn1",
        title: "Melhor caso lançamento",
        description: "Adoção rápida",
        confidence: 60,
        impact: "HIGH",
        status: "SAVED",
        updatedAt: new Date().toISOString(),
      },
    ],
    ...partial,
  };
}

const viewer = {
  userId: "u1",
  workspaceId: "ws1" as string | null,
  isWorkspaceMember: true,
};

describe("Sprint 7.2 Registry", () => {
  test("registers 7 builtin prioritizers", () => {
    ensureBuiltinPriorityEngines();
    const engines = listPriorityEngines();
    assert.equal(engines.length, 7);
    assert.ok(engines.some((e) => e.id === "impact_prioritizer_v1"));
    assert.ok(engines.some((e) => e.id === "urgency_prioritizer_v1"));
    assert.ok(engines.some((e) => e.id === "stale_prioritizer_v1"));
  });

  test("runPriorityRegistry produces candidates with executionInfluence none", () => {
    const ctx = buildPriorityContext({ sources: sources() });
    const run = runPriorityRegistry(ctx, { userId: "u1", workspaceId: "ws1" });
    assert.ok(run.enginesRun >= 7);
    assert.ok(run.candidates.length > 0);
    assert.ok(run.candidates.every((c) => c.executionInfluence === "none"));
  });
});

describe("Sprint 7.2 Score", () => {
  test("SCORE_WEIGHTS are documented constants", () => {
    assert.equal(SCORE_WEIGHTS.impact, 20);
    assert.equal(SCORE_WEIGHTS.urgency, 18);
    assert.equal(SCORE_WEIGHTS.confidence, 0.35);
    assert.equal(SCORE_WEIGHTS.effort, 8);
    assert.equal(SCORE_WEIGHTS.reversibility, 6);
    assert.equal(SCORE_WEIGHTS.recency, 10);
    assert.equal(SCORE_WEIGHTS.completeness, 0.15);
  });

  test("computePriorityScore is transparent and deterministic", () => {
    const high = computePriorityScore({
      impact: "HIGH",
      urgency: "HIGH",
      confidence: 90,
      effort: "LOW",
      reversibility: "HIGH",
      signalObservedAt: new Date().toISOString(),
      completenessScore: 100,
    });
    const low = computePriorityScore({
      impact: "LOW",
      urgency: "LOW",
      confidence: 20,
      effort: "HIGH",
      reversibility: "LOW",
      signalObservedAt: new Date(
        Date.now() - 120 * 24 * 60 * 60 * 1000
      ).toISOString(),
      completenessScore: 10,
    });
    assert.ok(high.total > low.total);
    const sumParts =
      high.impact +
      high.urgency +
      high.confidence +
      high.effort +
      high.reversibility +
      high.recency +
      high.completeness;
    assert.ok(Math.abs(sumParts - high.total) < 0.02);
  });

  test("recencyFactor decays after 7 days", () => {
    assert.equal(recencyFactor(new Date().toISOString()), 1);
    assert.ok(
      recencyFactor(
        new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      ) < 1
    );
    assert.equal(
      recencyFactor(
        new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
      ),
      0
    );
  });
});

describe("Sprint 7.2 Ranking", () => {
  test("rankPriorityItems sorts by priorityScore and sets ranking", () => {
    const { items } = generatePrioritiesPure(createEmptyPriorityState(), {
      userId: "u1",
      sources: sources(),
    });
    assert.ok(items.length > 0);
    const ranked = rankPriorityItems(items);
    assert.equal(ranked[0].ranking, 1);
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i - 1].priorityScore >= ranked[i].priorityScore);
      assert.equal(ranked[i].ranking, i + 1);
    }
  });
});

describe("Sprint 7.2 Validator", () => {
  test("rejects without evidence limitations confidence score", () => {
    const good = impactPrioritizer.prioritize(
      buildPriorityContext({ sources: sources() }),
      { userId: "u1" }
    )[0];
    assert.ok(good);
    const bad = {
      ...good,
      evidence: [],
      limitations: [],
      priorityScore: undefined as unknown as number,
    };
    const result = validatePriorityCandidate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes("missing_evidence"));
    assert.ok(result.errors.includes("missing_limitations"));
    assert.ok(result.errors.includes("missing_score"));
  });

  test("rejects non-none executionInfluence", () => {
    const good = impactPrioritizer.prioritize(
      buildPriorityContext({ sources: sources() }),
      { userId: "u1" }
    )[0];
    const tainted = {
      ...good,
      executionInfluence: "write" as unknown as "none",
    };
    assert.equal(validatePriorityCandidate(tainted).ok, false);
  });

  test("filterValidPriorityCandidates keeps only valid", () => {
    const ctx = buildPriorityContext({ sources: sources() });
    const { candidates } = runPriorityRegistry(ctx, { userId: "u1" });
    const { valid, rejected } = filterValidPriorityCandidates(candidates);
    assert.ok(valid.length > 0);
    assert.equal(rejected.length, 0);
    assert.ok(valid.every((c) => c.executionInfluence === "none"));
  });
});

describe("Sprint 7.2 Feedback", () => {
  test("confirm ignore archive request_review are auditable", () => {
    let state = createEmptyPriorityState();
    const gen = generatePrioritiesPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      sources: sources(),
    });
    state = gen.state;
    assert.ok(gen.items.length > 0);
    const id = gen.items[0].id;

    const confirmed = applyPriorityFeedbackPure(state, {
      userId: "u1",
      priorityId: id,
      kind: "confirm",
      note: "ok",
    });
    assert.equal(confirmed.item?.status, "CONFIRMED");
    assert.equal(confirmed.state.feedback[0].kind, "confirm");
    assert.ok(
      confirmed.state.audit.some((a) => a.action === "feedback:confirm")
    );
    assert.equal(confirmed.item?.executionInfluence, "none");

    state = confirmed.state;
    const review = applyPriorityFeedbackPure(state, {
      userId: "u1",
      priorityId: id,
      kind: "request_review",
    });
    assert.equal(review.item?.status, "NEEDS_REVIEW");
  });
});

describe("Sprint 7.2 Search & Home", () => {
  test("search finds priorities and home week widget populates", () => {
    let state = createEmptyPriorityState();
    state = generatePrioritiesPure(state, {
      userId: "u1",
      sources: sources(),
    }).state;
    const any = listPrioritiesPure(state, viewer, { limit: 20 });
    assert.ok(any.length > 0);
    const q = any[0].title.slice(0, 8).toLowerCase();
    assert.ok(searchPrioritiesPure(state, viewer, q).length >= 1);

    const home = getHomePriorityWidgetPure(state, viewer);
    assert.ok(Array.isArray(home.weekPriorities));
    assert.ok(home.weekPriorities.length >= 1);
  });
});

describe("Sprint 7.2 Workspace & RLS mirrors", () => {
  test("PRIVATE priorities not visible to other members", () => {
    let state = createEmptyPriorityState();
    state = generatePrioritiesPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      sources: sources(),
    }).state;
    const item = state.items[0];
    assert.equal(item.visibilityScope, "PRIVATE");
    assert.equal(
      canViewPriority(item, {
        userId: "u2",
        workspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
    assert.equal(getPriorityPure(state, { userId: "u2" }, item.id), null);
  });
});

describe("Sprint 7.2 Comparison", () => {
  test("compare shows score diffs without execution", () => {
    let state = createEmptyPriorityState();
    state = generatePrioritiesPure(state, {
      userId: "u1",
      sources: sources(),
    }).state;
    assert.ok(state.items.length >= 2);
    const res = comparePrioritiesPure(state, {
      userId: "u1",
      priorityIds: [state.items[0].id, state.items[1].id],
    });
    assert.equal(res.error, null);
    assert.ok(res.comparison);
    assert.equal(res.comparison!.executionInfluence, "none");
    assert.equal(res.comparison!.scoreDiffs.length, 2);
    assert.ok(
      res.comparison!.scoreDiffs.some((d) => d.deltaFromLeader === 0)
    );
  });
});

describe("Sprint 7.2 Explanation & influence", () => {
  test("explanation includes why criteria evidence limitations alternatives", () => {
    const state = generatePrioritiesPure(createEmptyPriorityState(), {
      userId: "u1",
      sources: sources(),
    }).state;
    const item = state.items[0];
    const exp = explainPriorityPure(item);
    assert.ok(exp.whyAppeared);
    assert.ok(exp.criteriaContributed.length);
    assert.ok(exp.evidenceSummaries.length);
    assert.ok(exp.limitations.length);
    assert.ok(exp.alternativeViews.length);
    assert.ok(exp.scoreBreakdown.total > 0);
    assert.equal(exp.executionInfluence, "none");
    assert.equal(PRIORITY_EXECUTION_INFLUENCE, "none");
  });

  test("context is read-only with executionInfluence none", () => {
    const ctx = buildPriorityContext({ sources: sources({ memories: [] }) });
    assert.equal(ctx.readOnly, true);
    assert.equal(ctx.executionInfluence, "none");
    assert.ok(ctx.dataCompleteness.gaps.includes("no_memories"));
  });
});

describe("Sprint 7.2 UI contracts", () => {
  test("priority items expose fields required by Priority Center UI", () => {
    const { items } = generatePrioritiesPure(createEmptyPriorityState(), {
      userId: "u1",
      sources: sources(),
    });
    for (const c of items.slice(0, 8)) {
      assert.ok(c.id && c.title && c.summary);
      assert.ok(typeof c.priorityScore === "number");
      assert.ok(c.evidence.length);
      assert.ok(c.limitations.length);
      assert.ok(c.alternativeViews.length);
      assert.ok(c.attentionReason);
      assert.equal(c.executionInfluence, "none");
      assert.ok(
        [
          "IMPACT",
          "URGENCY",
          "CONFIDENCE",
          "OPPORTUNITY",
          "RISK",
          "REVIEW",
          "STALE",
        ].includes(c.kind)
      );
    }
  });

  test("filters by kind impact urgency status project", () => {
    let state = createEmptyPriorityState();
    state = generatePrioritiesPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      sources: sources(),
    }).state;
    const byKind = listPrioritiesPure(state, viewer, { kind: "RISK" });
    assert.ok(byKind.every((i) => i.kind === "RISK"));
    const byImpact = listPrioritiesPure(state, viewer, { impact: "HIGH" });
    assert.ok(byImpact.every((i) => i.impact === "HIGH"));
  });
});

describe("Sprint 7.2 Typecheck surface", () => {
  test("PriorityItem literal keeps executionInfluence none", () => {
    const sample: PriorityItem["executionInfluence"] = "none";
    assert.equal(sample, "none");
  });
});

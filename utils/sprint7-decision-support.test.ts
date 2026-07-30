/**
 * Sprint 7.0 Decision Support Foundation — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  applyDecisionFeedbackPure,
  buildDecisionContext,
  canViewDecision,
  clearDecisionRegistry,
  clearDecisionState,
  createEmptyDecisionState,
  DECISION_EXECUTION_INFLUENCE,
  ensureBuiltinDecisionEngines,
  explainDecisionPure,
  filterValidCandidates,
  generateDecisionsPure,
  getDecisionPure,
  getHomeDecisionWidgetPure,
  listDecisionEngines,
  listDecisionsPure,
  priorityEngine,
  rankDecisionCards,
  decisionRankScore,
  runDecisionRegistry,
  searchDecisionsPure,
  tradeoffEngine,
  validateDecisionCandidate,
  type DecisionCard,
  type DecisionSourceSlice,
} from "@/lib/decision-support";

beforeEach(() => {
  clearDecisionState();
  clearDecisionRegistry();
});

function sources(partial: Partial<DecisionSourceSlice> = {}): DecisionSourceSlice {
  return {
    memories: [{ id: "m1", title: "Memória base", confidence: 70 }],
    worldEntities: [{ id: "e1", name: "Cliente X", entityType: "person" }],
    cognitiveArtifacts: [
      {
        id: "c1",
        title: "Insight fraco",
        summary: "baixa confiança",
        artifactType: "INSIGHT",
        confidence: 30,
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
      },
    ],
    knowledgeDocuments: [
      {
        id: "k1",
        title: "Playbook antigo",
        type: "note",
        summary: "legado",
        updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    projects: [
      {
        id: "p1",
        name: "Lançamento",
        status: "active",
        description: "MVP go-to-market",
        updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "p2",
        name: "Pausado",
        status: "paused",
        description: "x",
        updatedAt: new Date().toISOString(),
      },
    ],
    businesses: [{ id: "b1", name: "Alvesz", segment: "agency" }],
    identityHints: [{ id: "i1", title: "Preferência foco" }],
    ...partial,
  };
}

const viewer = {
  userId: "u1",
  workspaceId: "ws1" as string | null,
  isWorkspaceMember: true,
};

describe("Sprint 7 Registry", () => {
  test("registers 7 builtin engines without hardcode in list", () => {
    ensureBuiltinDecisionEngines();
    const engines = listDecisionEngines();
    assert.equal(engines.length, 7);
    assert.ok(engines.some((e) => e.id === "priority_v1"));
    assert.ok(engines.some((e) => e.id === "tradeoff_v1"));
    assert.ok(engines.some((e) => e.id === "missing_information_v1"));
  });

  test("runDecisionRegistry produces candidates", () => {
    const ctx = buildDecisionContext({ sources: sources() });
    const run = runDecisionRegistry(ctx, { userId: "u1", workspaceId: "ws1" });
    assert.ok(run.enginesRun >= 7);
    assert.ok(run.candidates.length > 0);
    assert.ok(run.candidates.every((c) => c.executionInfluence === "none"));
  });
});

describe("Sprint 7 Priority & Tradeoff", () => {
  test("priority engine suggests without mutating projects", () => {
    const ctx = buildDecisionContext({ sources: sources() });
    const found = priorityEngine.analyze(ctx, { userId: "u1", max: 3 });
    assert.ok(found.length >= 1);
    assert.equal(found[0].kind, "PRIORITY");
    assert.ok(found[0].limitations.some((l) => /não cria tarefas/i.test(l)));
    assert.equal(found[0].executionInfluence, "none");
  });

  test("tradeoff engine exposes advantages disadvantages risks uncertainties", () => {
    const ctx = buildDecisionContext({ sources: sources() });
    const found = tradeoffEngine.analyze(ctx, { userId: "u1", max: 2 });
    assert.ok(found.length >= 1);
    assert.ok(found[0].tradeoff);
    assert.ok(found[0].tradeoff!.advantages.length);
    assert.ok(found[0].tradeoff!.disadvantages.length);
    assert.ok(found[0].tradeoff!.risks.length);
    assert.ok(found[0].tradeoff!.uncertainties.length);
  });
});

describe("Sprint 7 Ranking", () => {
  test("ranks by impact urgency confidence effort reversibility", () => {
    const base = {
      userId: "u1",
      workspaceId: null,
      engineId: "priority_v1" as const,
      kind: "PRIORITY" as const,
      title: "A",
      summary: "s",
      context: "c",
      confidenceBand: "MEDIUM" as const,
      evidence: [
        {
          id: "e",
          evidenceType: "t",
          sourceLayer: "discovery" as const,
          sourceType: "x",
          sourceId: "1",
          summary: "e",
          confidence: 50,
          observedAt: new Date().toISOString(),
        },
      ],
      limitations: ["l"],
      alternativeOptions: [
        {
          id: "a",
          title: "alt",
          summary: "s",
          pros: ["p"],
          cons: ["c"],
        },
      ],
      status: "SUGGESTED" as const,
      executionInfluence: "none" as const,
      visibilityScope: "PRIVATE" as const,
      explanation: "ex",
      whyAppeared: "why",
      relatedProjectIds: [],
      relatedBusinessIds: [],
      relatedDocumentIds: [],
      relatedDiscoveryIds: [],
      relatedMemoryIds: [],
      relatedEntityIds: [],
      fingerprint: "fp",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastReviewedAt: null,
    };
    const low: DecisionCard = {
      ...base,
      id: "1",
      confidence: 40,
      impact: "LOW",
      urgency: "LOW",
      effort: "HIGH",
      reversibility: "LOW",
    };
    const high: DecisionCard = {
      ...base,
      id: "2",
      title: "B",
      fingerprint: "fp2",
      confidence: 90,
      impact: "HIGH",
      urgency: "HIGH",
      effort: "LOW",
      reversibility: "HIGH",
    };
    assert.ok(decisionRankScore(high) > decisionRankScore(low));
    const ranked = rankDecisionCards([low, high]);
    assert.equal(ranked[0].id, "2");
  });
});

describe("Sprint 7 Validator", () => {
  test("rejects cards without evidence limitations alternatives", () => {
    const bad = {
      ...priorityEngine.analyze(buildDecisionContext({ sources: sources() }), {
        userId: "u1",
      })[0],
      evidence: [],
      limitations: [],
      alternativeOptions: [],
    };
    const result = validateDecisionCandidate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes("missing_evidence"));
    assert.ok(result.errors.includes("missing_limitations"));
    assert.ok(result.errors.includes("missing_alternativeOptions"));
  });

  test("rejects non-none executionInfluence", () => {
    const good = priorityEngine.analyze(
      buildDecisionContext({ sources: sources() }),
      { userId: "u1" }
    )[0];
    const tainted = {
      ...good,
      executionInfluence: "write" as unknown as "none",
    };
    assert.equal(validateDecisionCandidate(tainted).ok, false);
  });

  test("filterValidCandidates keeps only valid", () => {
    const ctx = buildDecisionContext({ sources: sources() });
    const { candidates } = runDecisionRegistry(ctx, { userId: "u1" });
    const { valid, rejected } = filterValidCandidates(candidates);
    assert.ok(valid.length > 0);
    assert.equal(rejected.length, 0);
    assert.ok(valid.every((c) => c.executionInfluence === "none"));
  });
});

describe("Sprint 7 Feedback", () => {
  test("accept ignore archive request_review are auditable", () => {
    let state = createEmptyDecisionState();
    const gen = generateDecisionsPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      sources: sources(),
    });
    state = gen.state;
    assert.ok(gen.cards.length > 0);
    const id = gen.cards[0].id;

    const accepted = applyDecisionFeedbackPure(state, {
      userId: "u1",
      decisionId: id,
      kind: "accept",
      note: "ok",
    });
    assert.equal(accepted.card?.status, "ACCEPTED");
    assert.equal(accepted.state.feedback[0].kind, "accept");
    assert.ok(accepted.state.audit.some((a) => a.action === "feedback:accept"));

    state = accepted.state;
    const review = applyDecisionFeedbackPure(state, {
      userId: "u1",
      decisionId: id,
      kind: "request_review",
    });
    assert.equal(review.card?.status, "NEEDS_REVIEW");
  });
});

describe("Sprint 7 Search & Home", () => {
  test("search finds decisions and home widgets populate", () => {
    let state = createEmptyDecisionState();
    state = generateDecisionsPure(state, {
      userId: "u1",
      sources: sources(),
    }).state;
    const hits = searchDecisionsPure(state, viewer, "prioridade");
    assert.ok(hits.length >= 0);
    const any = listDecisionsPure(state, viewer, { limit: 20 });
    assert.ok(any.length > 0);
    const q = any[0].title.slice(0, 8).toLowerCase();
    assert.ok(searchDecisionsPure(state, viewer, q).length >= 1);

    const home = getHomeDecisionWidgetPure(state, viewer);
    assert.ok(Array.isArray(home.priorities));
    assert.ok(Array.isArray(home.inReview));
    assert.ok(Array.isArray(home.insufficientData));
  });
});

describe("Sprint 7 Workspace & RLS mirrors", () => {
  test("PRIVATE decisions not visible to other members", () => {
    let state = createEmptyDecisionState();
    state = generateDecisionsPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      sources: sources(),
    }).state;
    const card = state.cards[0];
    assert.equal(card.visibilityScope, "PRIVATE");
    assert.equal(
      canViewDecision(card, {
        userId: "u2",
        workspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
    assert.equal(getDecisionPure(state, { userId: "u2" }, card.id), null);
  });
});

describe("Sprint 7 Explanation & influence", () => {
  test("explanation includes why evidence limitations alternatives", () => {
    const state = generateDecisionsPure(createEmptyDecisionState(), {
      userId: "u1",
      sources: sources(),
    }).state;
    const card = state.cards[0];
    const exp = explainDecisionPure(card);
    assert.ok(exp.whyAppeared);
    assert.ok(exp.evidenceSummaries.length);
    assert.ok(exp.limitations.length);
    assert.ok(exp.alternatives.length);
    assert.equal(exp.executionInfluence, "none");
    assert.equal(DECISION_EXECUTION_INFLUENCE, "none");
  });

  test("context is read-only with executionInfluence none", () => {
    const ctx = buildDecisionContext({ sources: sources({ memories: [] }) });
    assert.equal(ctx.readOnly, true);
    assert.equal(ctx.executionInfluence, "none");
    assert.ok(ctx.dataCompleteness.gaps.includes("no_memories"));
  });
});

describe("Sprint 7 UI contracts", () => {
  test("decision cards expose fields required by Decision Center UI", () => {
    const { cards } = generateDecisionsPure(createEmptyDecisionState(), {
      userId: "u1",
      sources: sources(),
    });
    for (const c of cards.slice(0, 5)) {
      assert.ok(c.id && c.title && c.summary && c.context);
      assert.ok(c.evidence.length);
      assert.ok(c.limitations.length);
      assert.ok(c.alternativeOptions.length);
      assert.equal(c.executionInfluence, "none");
      assert.ok(["PRIORITY", "TRADEOFF", "REVIEW", "OPPORTUNITY", "RISK", "MISSING_INFO", "STALE"].includes(c.kind));
    }
  });
});

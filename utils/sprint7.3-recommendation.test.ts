/**
 * Sprint 7.3 Recommendation Engine — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  annotateRecommendationConflicts,
  applyRecommendationFeedbackPure,
  buildRecommendationContext,
  canViewRecommendation,
  clearRecommendationRegistry,
  clearRecommendationState,
  computeRecommendationScore,
  createEmptyRecommendationState,
  ensureBuiltinRecommendationEngines,
  explainRecommendationPure,
  filterValidRecommendationCandidates,
  generateRecommendationsPure,
  getHomeRecommendationWidgetPure,
  getRecommendationPure,
  listRecommendationEngines,
  listRecommendationsPure,
  RECOMMENDATION_EXECUTION_INFLUENCE,
  RECOMMENDATION_PROVIDER_LAYERS,
  rankRecommendationItems,
  runRecommendationRegistry,
  SCORE_WEIGHTS,
  searchRecommendationsPure,
  validateRecommendationCandidate,
  type RecommendationCard,
  type RecommendationSourceSlice,
} from "@/lib/recommendation";
import { existsSync } from "node:fs";
import { join } from "node:path";

beforeEach(() => {
  clearRecommendationState();
  clearRecommendationRegistry();
});

function sources(
  partial: Partial<RecommendationSourceSlice> = {}
): RecommendationSourceSlice {
  return {
    identityHints: [{ id: "i1", title: "Foco deliberado" }],
    memories: [{ id: "m1", title: "Memória base", confidence: 70 }],
    worldEntities: [
      { id: "e1", name: "Cliente X", entityType: "person" },
    ],
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
        title: "Playbook",
        type: "note",
        summary: "legado",
        updatedAt: new Date().toISOString(),
      },
    ],
    projects: [
      {
        id: "p1",
        name: "Lançamento",
        status: "active",
        description: "MVP go-to-market",
        updatedAt: new Date().toISOString(),
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
    priorities: [
      {
        id: "prio1",
        title: "Oportunidade: Oportunidade MVP",
        summary: "Atenção a B2B",
        kind: "OPPORTUNITY",
        confidence: 70,
        priorityScore: 120,
        impact: "HIGH",
        urgency: "MEDIUM",
        status: "SUGGESTED",
        updatedAt: new Date().toISOString(),
      },
      {
        id: "prio2",
        title: "Risco: Risco churn",
        summary: "Atenção a retenção",
        kind: "RISK",
        confidence: 65,
        priorityScore: 130,
        impact: "HIGH",
        urgency: "HIGH",
        status: "SUGGESTED",
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

describe("Sprint 7.3 Registry", () => {
  test("registers 6 builtin recommenders", () => {
    ensureBuiltinRecommendationEngines();
    const engines = listRecommendationEngines();
    assert.equal(engines.length, 6);
    assert.ok(engines.some((e) => e.id === "opportunity_recommender_v1"));
    assert.ok(engines.some((e) => e.id === "risk_recommender_v1"));
    assert.ok(engines.some((e) => e.id === "project_recommender_v1"));
    assert.ok(engines.some((e) => e.id === "learning_recommender_v1"));
    assert.ok(engines.some((e) => e.id === "relationship_recommender_v1"));
    assert.ok(engines.some((e) => e.id === "review_recommender_v1"));
  });

  test("runRecommendationRegistry produces candidates with executionInfluence none", () => {
    const ctx = buildRecommendationContext({ sources: sources() });
    const run = runRecommendationRegistry(ctx, {
      userId: "u1",
      workspaceId: "ws1",
    });
    assert.ok(run.enginesRun >= 6);
    assert.ok(run.candidates.length > 0);
    assert.ok(run.candidates.every((c) => c.executionInfluence === "none"));
  });
});

describe("Sprint 7.3 Engines", () => {
  test("generateRecommendationsPure creates cards with required fields", () => {
    const { items, rejectedCount } = generateRecommendationsPure(
      createEmptyRecommendationState(),
      { userId: "u1", workspaceId: "ws1", sources: sources() }
    );
    assert.ok(items.length > 0);
    assert.equal(typeof rejectedCount, "number");
    for (const item of items) {
      assert.ok(item.evidence.length >= 1);
      assert.ok(item.limitations.length >= 1);
      assert.ok(item.alternatives.length >= 1);
      assert.ok(item.reasoning.whyAppeared);
      assert.equal(item.executionInfluence, "none");
    }
  });
});

describe("Sprint 7.3 Validator", () => {
  test("rejects missing evidence / alternatives / reasoning / non-none influence", () => {
    const ctx = buildRecommendationContext({ sources: sources() });
    const run = runRecommendationRegistry(ctx, { userId: "u1" });
    const base = run.candidates[0];
    assert.ok(base);

    const badEvidence = { ...base, evidence: [] };
    assert.equal(validateRecommendationCandidate(badEvidence).ok, false);

    const badAlts = { ...base, alternatives: [] };
    assert.equal(validateRecommendationCandidate(badAlts).ok, false);

    const badReasoning = {
      ...base,
      reasoning: {
        whyAppeared: "",
        criteriaWeighted: [],
        evidenceUsed: [],
        missingInformation: [],
        alternativesConsidered: [],
      },
    };
    assert.equal(validateRecommendationCandidate(badReasoning).ok, false);

    const badExec = {
      ...base,
      executionInfluence: "write" as unknown as "none",
    };
    assert.equal(validateRecommendationCandidate(badExec).ok, false);

    const { valid } = filterValidRecommendationCandidates(run.candidates);
    assert.ok(valid.every((c) => c.executionInfluence === "none"));
  });
});

describe("Sprint 7.3 Feedback", () => {
  test("accept / ignore / archive / request_review are auditable", () => {
    let state = createEmptyRecommendationState();
    const gen = generateRecommendationsPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      sources: sources(),
    });
    state = gen.state;
    const id = gen.items[0]?.id;
    assert.ok(id);

    const accepted = applyRecommendationFeedbackPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      recommendationId: id,
      kind: "accept",
    });
    assert.equal(accepted.item?.status, "ACCEPTED");
    assert.equal(accepted.item?.executionInfluence, "none");
    assert.ok(accepted.feedback);
    assert.ok(accepted.state.audit.some((a) => a.action === "feedback:accept"));

    const ignored = applyRecommendationFeedbackPure(accepted.state, {
      userId: "u1",
      recommendationId: id,
      kind: "ignore",
    });
    assert.equal(ignored.item?.status, "IGNORED");
  });
});

describe("Sprint 7.3 Search & Home", () => {
  test("search and home widget", () => {
    const { state, items } = generateRecommendationsPure(
      createEmptyRecommendationState(),
      { userId: "u1", workspaceId: "ws1", sources: sources() }
    );
    assert.ok(items.length > 0);
    const q = items[0].title.slice(0, 8).toLowerCase();
    assert.ok(searchRecommendationsPure(state, viewer, q).length >= 1);
    const home = getHomeRecommendationWidgetPure(state, viewer);
    assert.ok(Array.isArray(home.weekRecommendations));
    assert.ok(home.weekRecommendations.length >= 1);
  });
});

describe("Sprint 7.3 Workspace / RLS visibility", () => {
  test("PRIVATE items not visible to other users", () => {
    const { state, items } = generateRecommendationsPure(
      createEmptyRecommendationState(),
      { userId: "u1", workspaceId: "ws1", sources: sources() }
    );
    const item = items[0];
    assert.ok(item);
    assert.equal(
      canViewRecommendation(item, {
        userId: "other",
        workspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
    assert.equal(canViewRecommendation(item, viewer), true);
    assert.ok(getRecommendationPure(state, viewer, item.id));
    assert.equal(
      getRecommendationPure(
        state,
        { userId: "other", workspaceId: "ws1", isWorkspaceMember: true },
        item.id
      ),
      null
    );
  });

  test("list respects workspace filter", () => {
    const { state } = generateRecommendationsPure(
      createEmptyRecommendationState(),
      { userId: "u1", workspaceId: "ws1", sources: sources() }
    );
    const listed = listRecommendationsPure(state, viewer, {
      workspaceId: "ws1",
      limit: 20,
    });
    assert.ok(listed.every((c) => c.workspaceId === "ws1"));
  });
});

describe("Sprint 7.3 Contradictions", () => {
  test("shows both conflicting recommendations without auto-choosing", () => {
    const { items } = generateRecommendationsPure(
      createEmptyRecommendationState(),
      { userId: "u1", workspaceId: "ws1", sources: sources() }
    );
    const opp = items.find((i) => i.recommendationType === "OPPORTUNITY");
    const risk = items.find((i) => i.recommendationType === "RISK");
    // Force shared project to create conflict annotation path
    if (opp && risk) {
      const annotated = annotateRecommendationConflicts([
        { ...opp, relatedProject: "p1", relatedDiscovery: "shared" },
        { ...risk, relatedProject: "p1", relatedDiscovery: "shared" },
      ]);
      assert.ok(annotated[0].conflicts.length >= 1);
      assert.ok(annotated[1].conflicts.length >= 1);
      assert.equal(annotated.length, 2);
    }
  });
});

describe("Sprint 7.3 Explainability & Score", () => {
  test("explain exposes pipeline and executionInfluence none", () => {
    const { items } = generateRecommendationsPure(
      createEmptyRecommendationState(),
      { userId: "u1", workspaceId: "ws1", sources: sources() }
    );
    const exp = explainRecommendationPure(items[0]);
    assert.ok(exp.pipelineSteps.length >= 1);
    assert.ok(exp.evidenceSummaries.length >= 1);
    assert.equal(exp.executionInfluence, "none");
  });

  test("SCORE_WEIGHTS and computeRecommendationScore", () => {
    assert.equal(SCORE_WEIGHTS.impact, 20);
    const high = computeRecommendationScore({
      impact: "HIGH",
      urgency: "HIGH",
      confidence: 90,
      effort: "LOW",
      reversibility: "HIGH",
      signalObservedAt: new Date().toISOString(),
      completenessScore: 100,
    });
    const low = computeRecommendationScore({
      impact: "LOW",
      urgency: "LOW",
      confidence: 10,
      effort: "HIGH",
      reversibility: "LOW",
      completenessScore: 0,
    });
    assert.ok(high.total > low.total);
  });

  test("RECOMMENDATION_EXECUTION_INFLUENCE is none", () => {
    assert.equal(RECOMMENDATION_EXECUTION_INFLUENCE, "none");
  });

  test("providers include prioritization layer", () => {
    assert.ok(RECOMMENDATION_PROVIDER_LAYERS.includes("prioritization"));
  });
});

describe("Sprint 7.3 UI routes", () => {
  test("recommendation center and detail pages exist", () => {
    assert.ok(
      existsSync(join(process.cwd(), "app/dashboard/recommendations/page.tsx"))
    );
    assert.ok(
      existsSync(
        join(process.cwd(), "app/dashboard/recommendations/[id]/page.tsx")
      )
    );
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "components/dashboard/recommendations/recommendation-center-client.tsx"
        )
      )
    );
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "components/dashboard/recommendations/recommendation-view-client.tsx"
        )
      )
    );
  });

  test("RecommendationCard literal keeps executionInfluence none", () => {
    const sample: RecommendationCard["executionInfluence"] = "none";
    assert.equal(sample, "none");
  });

  test("rankRecommendationItems assigns ranking", () => {
    const { items } = generateRecommendationsPure(
      createEmptyRecommendationState(),
      { userId: "u1", workspaceId: "ws1", sources: sources() }
    );
    const ranked = rankRecommendationItems(items);
    assert.equal(ranked[0].ranking, 1);
  });
});

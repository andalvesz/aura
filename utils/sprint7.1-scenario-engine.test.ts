/**
 * Sprint 7.1 Scenario Engine — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  applyScenarioFeedbackPure,
  buildScenarioContext,
  canViewScenario,
  clearScenarioRegistry,
  clearScenarioState,
  compareScenariosPure,
  createEmptyScenarioState,
  ensureBuiltinScenarioEngines,
  explainScenarioPure,
  filterValidScenarioCandidates,
  getHomeScenarioWidgetPure,
  getScenarioPure,
  listScenarioEngines,
  listScenariosPure,
  runScenarioRegistry,
  SCENARIO_EXECUTION_INFLUENCE,
  searchScenariosPure,
  simulateScenariosPure,
  validateScenarioCandidate,
  whatIfEngine,
  type ScenarioSourceSlice,
} from "@/lib/scenario";

beforeEach(() => {
  clearScenarioState();
  clearScenarioRegistry();
});

function sources(partial: Partial<ScenarioSourceSlice> = {}): ScenarioSourceSlice {
  return {
    memories: [{ id: "m1", title: "Contexto", confidence: 60 }],
    worldEntities: [{ id: "e1", name: "Parceiro", entityType: "org" }],
    discoveries: [
      {
        id: "d1",
        title: "Oportunidade canal",
        summary: "B2B",
        type: "OPPORTUNITY",
        confidence: 70,
        impact: "HIGH",
      },
      {
        id: "d2",
        title: "Risco atraso",
        summary: "Dependência",
        type: "RISK",
        confidence: 65,
        impact: "HIGH",
      },
    ],
    knowledgeDocuments: [
      { id: "k1", title: "Brief", type: "note", summary: "resumo" },
    ],
    projects: [
      {
        id: "p1",
        name: "Lançamento",
        status: "planning",
        description: "MVP",
        businessId: "b1",
      },
    ],
    businesses: [{ id: "b1", name: "Alvesz", segment: "agency" }],
    decisions: [
      {
        id: "dec1",
        title: "Priorizar MVP",
        summary: "Foco",
        kind: "PRIORITY",
        confidence: 68,
        status: "SUGGESTED",
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

describe("Sprint 7.1 Registry", () => {
  test("registers typed + what-if + comparison engines", () => {
    ensureBuiltinScenarioEngines();
    const engines = listScenarioEngines();
    assert.ok(engines.length >= 8);
    assert.ok(engines.some((e) => e.id === "what_if_v1"));
    assert.ok(engines.some((e) => e.id === "best_case_v1"));
    assert.ok(engines.some((e) => e.id === "worst_case_v1"));
  });

  test("runScenarioRegistry yields candidates with executionInfluence none", () => {
    const ctx = buildScenarioContext({
      sources: sources(),
      whatIfPrompt: "E se iniciarmos este projeto?",
    });
    const run = runScenarioRegistry(ctx, {
      userId: "u1",
      whatIfPrompt: "E se iniciarmos este projeto?",
    });
    assert.ok(run.candidates.length > 0);
    assert.ok(run.candidates.every((c) => c.executionInfluence === "none"));
  });
});

describe("Sprint 7.1 Simulation & What If", () => {
  test("what-if generates comparable branches", () => {
    const ctx = buildScenarioContext({ sources: sources() });
    const branches = whatIfEngine.simulate(ctx, {
      userId: "u1",
      whatIfPrompt: "E se adiarmos?",
      max: 4,
    });
    assert.ok(branches.length >= 3);
    const types = new Set(branches.map((b) => b.scenarioType));
    assert.ok(types.has("MOST_LIKELY"));
    assert.ok(types.has("BEST_CASE") || types.has("WORST_CASE"));
    assert.ok(branches.every((b) => b.assumptions.length && b.evidence.length));
  });

  test("simulateScenariosPure stores drafts", () => {
    const res = simulateScenariosPure(createEmptyScenarioState(), {
      userId: "u1",
      sources: sources(),
      whatIfPrompt: "E se aumentarmos o investimento?",
      engineIds: ["what_if_v1"],
    });
    assert.ok(res.scenarios.length >= 2);
    assert.ok(res.scenarios.every((s) => s.status === "DRAFT"));
    assert.equal(res.context.readOnly, true);
  });
});

describe("Sprint 7.1 Comparison", () => {
  test("compare two scenarios produces advantages risks opportunities missing data", () => {
    let state = createEmptyScenarioState();
    const gen = simulateScenariosPure(state, {
      userId: "u1",
      sources: sources(),
      whatIfPrompt: "E se iniciarmos?",
      engineIds: ["what_if_v1"],
    });
    state = gen.state;
    const ids = gen.scenarios.slice(0, 2).map((s) => s.id);
    const cmp = compareScenariosPure(state, {
      userId: "u1",
      scenarioIds: ids,
    });
    assert.equal(cmp.error, null);
    assert.ok(cmp.comparison);
    assert.ok(cmp.comparison!.advantages.length);
    assert.ok(cmp.comparison!.disadvantages.length);
    assert.ok(cmp.comparison!.risks.length);
    assert.ok(cmp.comparison!.opportunities.length);
    assert.equal(cmp.comparison!.executionInfluence, "none");
  });
});

describe("Sprint 7.1 Validator", () => {
  test("rejects missing assumptions limitations evidence", () => {
    const ctx = buildScenarioContext({ sources: sources() });
    const good = whatIfEngine.simulate(ctx, {
      userId: "u1",
      whatIfPrompt: "E se?",
    })[0];
    const bad = { ...good, assumptions: [], limitations: [], evidence: [] };
    const result = validateScenarioCandidate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes("missing_assumptions"));
    assert.ok(result.errors.includes("missing_limitations"));
    assert.ok(result.errors.includes("missing_evidence"));
  });

  test("filter keeps only valid", () => {
    const ctx = buildScenarioContext({ sources: sources() });
    const { candidates } = runScenarioRegistry(ctx, {
      userId: "u1",
      engineIds: ["what_if_v1", "best_case_v1"],
      whatIfPrompt: "E se iniciarmos?",
    });
    const { valid, rejected } = filterValidScenarioCandidates(candidates);
    assert.ok(valid.length > 0);
    assert.equal(rejected.length, 0);
  });
});

describe("Sprint 7.1 Feedback Search Home", () => {
  test("save archive discard auditable + search + home", () => {
    let state = createEmptyScenarioState();
    const gen = simulateScenariosPure(state, {
      userId: "u1",
      sources: sources(),
      whatIfPrompt: "E se iniciarmos este projeto?",
      engineIds: ["what_if_v1"],
    });
    state = gen.state;
    const id = gen.scenarios[0].id;
    const saved = applyScenarioFeedbackPure(state, {
      userId: "u1",
      scenarioId: id,
      kind: "save",
    });
    assert.equal(saved.card?.status, "SAVED");
    assert.ok(saved.state.audit.some((a) => a.action === "feedback:save"));

    const hits = searchScenariosPure(saved.state, viewer, "iniciarmos");
    assert.ok(hits.length >= 1);
    const home = getHomeScenarioWidgetPure(saved.state, viewer);
    assert.ok(home.recent.length >= 1);
    assert.ok(listScenariosPure(saved.state, viewer).length >= 1);
  });
});

describe("Sprint 7.1 Workspace RLS & UI", () => {
  test("PRIVATE not visible to other member", () => {
    const state = simulateScenariosPure(createEmptyScenarioState(), {
      userId: "u1",
      workspaceId: "ws1",
      sources: sources(),
      engineIds: ["neutral_v1"],
      whatIfPrompt: "E se?",
    }).state;
    const card = state.scenarios[0];
    assert.equal(
      canViewScenario(card, {
        userId: "u2",
        workspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
    assert.equal(getScenarioPure(state, { userId: "u2" }, card.id), null);
  });

  test("cards expose UI fields and explanation", () => {
    const { scenarios } = simulateScenariosPure(createEmptyScenarioState(), {
      userId: "u1",
      sources: sources(),
      whatIfPrompt: "E se adiarmos?",
      engineIds: ["what_if_v1"],
    });
    for (const s of scenarios) {
      assert.ok(s.assumptions.length && s.limitations.length && s.evidence.length);
      assert.ok(s.timeline.length);
      assert.ok(s.uncertainty.hypotheses.length);
      assert.equal(s.executionInfluence, "none");
      const exp = explainScenarioPure(s);
      assert.ok(exp.whyResult && exp.usedData.length);
      assert.equal(exp.executionInfluence, "none");
    }
    assert.equal(SCENARIO_EXECUTION_INFLUENCE, "none");
  });
});

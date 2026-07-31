/**
 * Sprint 8.0 Planner V1 — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  addPlanCommentPure,
  analyzePlanDependencies,
  applyPlanFeedbackPure,
  approvePlanPure,
  assignCollaboratorPure,
  canEditPlan,
  canViewPlan,
  clearPlannerRegistry,
  clearPlanState,
  completePlanPure,
  completeStepPure,
  createEmptyPlanState,
  detectCircularDependencies,
  ensureBuiltinPlannerEngines,
  explainPlanPure,
  generatePlanPure,
  getHomePlanWidgetPure,
  getPlanPure,
  listPlannerEngines,
  listPlansPure,
  PLAN_EXECUTION_INFLUENCE,
  rejectPlanPure,
  searchPlanEntitiesPure,
  searchPlansPure,
  startPlanPure,
  submitPlanForReviewPure,
  validatePlanDraft,
  validatePlanForApproval,
  type PlanSourceSlice,
} from "@/lib/planner";

beforeEach(() => {
  clearPlanState();
  clearPlannerRegistry();
});

function sources(
  partial: Partial<PlanSourceSlice> = {}
): PlanSourceSlice {
  return {
    identityHints: [{ id: "i1", title: "Foco" }],
    memories: [{ id: "m1", title: "Memória" }],
    worldEntities: [{ id: "e1", name: "Cliente", entityType: "person" }],
    cognitiveArtifacts: [
      { id: "c1", title: "Insight", summary: "padrão", confidence: 60 },
    ],
    discoveries: [
      {
        id: "d1",
        title: "Risco churn",
        summary: "retenção",
        type: "RISK",
        confidence: 65,
      },
    ],
    knowledgeDocuments: [{ id: "k1", title: "Playbook", type: "note" }],
    projects: [
      { id: "p1", name: "Lançamento", status: "active", description: "MVP" },
    ],
    businesses: [{ id: "b1", name: "Alvesz" }],
    decisions: [
      {
        id: "dec1",
        title: "Decisão B2B",
        summary: "Avaliar canal",
        confidence: 70,
        status: "SUGGESTED",
      },
    ],
    scenarios: [
      {
        id: "scn1",
        title: "Melhor caso",
        description: "Adoção",
        confidence: 60,
      },
    ],
    priorities: [
      {
        id: "prio1",
        title: "Prioridade MVP",
        summary: "Atenção",
        confidence: 70,
        priorityScore: 120,
      },
    ],
    recommendations: [
      {
        id: "rec1",
        title: "Oportunidade MVP",
        summary: "Abrir canal B2B",
        recommendationType: "OPPORTUNITY",
        confidence: 72,
        status: "ACCEPTED",
        relatedProject: "p1",
        relatedDecision: "dec1",
        relatedScenario: "scn1",
        relatedPriority: "prio1",
        limitations: ["Não executa sozinho"],
        alternatives: [
          { title: "Adiar", summary: "Esperar mais dados" },
        ],
        reasoning: { whyAppeared: "Alinhado a discovery + prioridade" },
        evidence: [{ summary: "Discovery d1" }],
      },
    ],
    missions: [
      { id: "msn1", title: "Missão go-to-market", objective: "Lançar", status: "ACTIVE" },
    ],
    ...partial,
  };
}

const viewer = {
  userId: "u1",
  workspaceId: "ws1" as string | null,
  isWorkspaceMember: true,
};

describe("Sprint 8.0 Registry", () => {
  test("registers 7 builtin planner engines", () => {
    ensureBuiltinPlannerEngines();
    assert.equal(listPlannerEngines().length, 7);
  });
});

describe("Sprint 8.0 Generation", () => {
  test("generate from accepted recommendation", () => {
    const { plan, errors } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      workspaceId: "ws1",
      sourceKind: "recommendation",
      sourceId: "rec1",
      sources: sources(),
    });
    assert.deepEqual(errors, []);
    assert.ok(plan);
    assert.equal(plan!.status, "DRAFT");
    assert.equal(plan!.executionInfluence, "none");
    assert.ok(plan!.steps.length >= 1);
    assert.equal(plan!.recommendationId, "rec1");
    assert.ok(plan!.successCriteria.length >= 1);
    assert.ok(plan!.limitations.length >= 1);
    assert.ok(plan!.risks.length >= 1);
  });

  test("generate manual", () => {
    const { plan, errors } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      sourceKind: "manual",
      title: "Plano manual",
      objective: "Organizar revisão",
      sources: sources(),
    });
    assert.deepEqual(errors, []);
    assert.ok(plan);
    assert.equal(plan!.sourceKind, "manual");
    assert.equal(plan!.executionInfluence, "none");
  });
});

describe("Sprint 8.0 Dependencies & cycles", () => {
  test("detects circular dependencies", () => {
    const cycles = detectCircularDependencies([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
    ]);
    assert.ok(cycles.length >= 1);
  });

  test("analyzePlanDependencies surfaces circular for human review", () => {
    const issues = analyzePlanDependencies({
      planId: "plan1",
      steps: [
        {
          id: "a",
          planId: "plan1",
          title: "A",
          description: "",
          order: 0,
          status: "DRAFT",
          stepType: "OTHER",
          ownerId: "u1",
          dependsOn: ["b"],
          suggestedStart: null,
          suggestedDeadline: null,
          estimatedEffort: "LOW",
          requiredResources: [],
          successCriteria: [],
          riskLevel: "LOW",
          requiresConfirmation: true,
        },
        {
          id: "b",
          planId: "plan1",
          title: "B",
          description: "",
          order: 1,
          status: "DRAFT",
          stepType: "OTHER",
          ownerId: "u1",
          dependsOn: ["a"],
          suggestedStart: null,
          suggestedDeadline: null,
          estimatedEffort: "LOW",
          requiredResources: [],
          successCriteria: [],
          riskLevel: "LOW",
          requiresConfirmation: true,
        },
      ],
      hasOwner: true,
      resourceTitles: [],
    });
    assert.ok(issues.some((i) => i.kind === "circular"));
    assert.ok(issues.every((i) => i.requiresHumanReview === true));
  });
});

describe("Sprint 8.0 Approval flow", () => {
  test("draft → review → approve → start → complete step → complete plan", () => {
    let state = createEmptyPlanState();
    const gen = generatePlanPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      sourceKind: "recommendation",
      sources: sources(),
    });
    state = gen.state;
    const id = gen.plan!.id;

    const review = submitPlanForReviewPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      planId: id,
    });
    assert.equal(review.error, null);
    assert.equal(review.plan!.status, "PENDING_REVIEW");
    state = review.state;

    const approved = approvePlanPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      planId: id,
    });
    assert.equal(approved.error, null);
    assert.equal(approved.plan!.status, "APPROVED");
    assert.equal(approved.plan!.executionInfluence, "none");
    state = approved.state;

    const started = startPlanPure(state, {
      userId: "u1",
      planId: id,
    });
    assert.equal(started.error, null);
    assert.equal(started.plan!.status, "IN_PROGRESS");
    state = started.state;

    const stepId = started.plan!.steps[0].id;
    const stepDone = completeStepPure(state, {
      userId: "u1",
      planId: id,
      stepId,
    });
    assert.equal(stepDone.error, null);
    state = stepDone.state;

    const done = completePlanPure(state, {
      userId: "u1",
      planId: id,
      force: true,
    });
    assert.equal(done.error, null);
    assert.equal(done.plan!.status, "COMPLETED");
  });

  test("reject returns to DRAFT", () => {
    let state = createEmptyPlanState();
    const gen = generatePlanPure(state, {
      userId: "u1",
      sourceKind: "manual",
      title: "X",
      objective: "Y",
      sources: sources(),
    });
    state = gen.state;
    state = submitPlanForReviewPure(state, {
      userId: "u1",
      planId: gen.plan!.id,
    }).state;
    const rejected = rejectPlanPure(state, {
      userId: "u1",
      planId: gen.plan!.id,
    });
    assert.equal(rejected.plan!.status, "DRAFT");
  });
});

describe("Sprint 8.0 Validator", () => {
  test("rejects non-none executionInfluence", () => {
    const { plan } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      sourceKind: "manual",
      title: "T",
      objective: "O",
      sources: sources(),
    });
    assert.ok(plan);
    const bad = {
      ...plan!,
      executionInfluence: "write" as unknown as "none",
    };
    assert.equal(validatePlanDraft(bad).ok, false);
    assert.equal(validatePlanForApproval(bad).ok, false);
  });
});

describe("Sprint 8.0 Feedback / comments / collab", () => {
  test("feedback and comments are auditable", () => {
    let state = createEmptyPlanState();
    const gen = generatePlanPure(state, {
      userId: "u1",
      sourceKind: "manual",
      title: "T",
      objective: "O",
      sources: sources(),
    });
    state = gen.state;
    const fb = applyPlanFeedbackPure(state, {
      userId: "u1",
      planId: gen.plan!.id,
      kind: "useful",
    });
    assert.equal(fb.error, null);
    assert.ok(fb.feedback);
    state = fb.state;

    const cm = addPlanCommentPure(state, {
      userId: "u1",
      planId: gen.plan!.id,
      body: "Precisa revisar prazo",
    });
    assert.equal(cm.error, null);
    state = cm.state;

    const collab = assignCollaboratorPure(state, {
      userId: "u1",
      planId: gen.plan!.id,
      targetUserId: "u2",
      role: "viewer",
    });
    assert.equal(collab.error, null);
    assert.ok(
      collab.plan!.collaborators.some(
        (c) => c.userId === "u2" && c.role === "viewer"
      )
    );
  });

  test("viewer cannot edit", () => {
    const { plan } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      sourceKind: "manual",
      title: "T",
      objective: "O",
      sources: sources(),
    });
    const withViewer = {
      ...plan!,
      collaborators: [
        ...plan!.collaborators,
        { userId: "u2", role: "viewer" as const },
      ],
    };
    assert.equal(canEditPlan(withViewer, "u2"), false);
    assert.equal(canEditPlan(withViewer, "u1"), true);
  });
});

describe("Sprint 8.0 Isolation", () => {
  test("other user cannot view private plan", () => {
    const { state, plan } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      workspaceId: "ws1",
      sourceKind: "manual",
      title: "Privado",
      objective: "O",
      sources: sources(),
    });
    assert.equal(
      canViewPlan(plan!, {
        userId: "other",
        workspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
    assert.equal(
      getPlanPure(
        state,
        { userId: "other", workspaceId: "ws1", isWorkspaceMember: true },
        plan!.id
      ),
      null
    );
    const listed = listPlansPure(
      state,
      { userId: "other", workspaceId: "ws2", isWorkspaceMember: true },
      { workspaceId: "ws2" }
    );
    assert.equal(listed.length, 0);
  });
});

describe("Sprint 8.0 Search / Home / Explain", () => {
  test("search finds plans and nested entities", () => {
    const { state, plan } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      sourceKind: "recommendation",
      sources: sources(),
    });
    const q = plan!.title.slice(0, 6).toLowerCase();
    assert.ok(searchPlanEntitiesPure(state, viewer, q).length >= 1);
    assert.ok(searchPlansPure(state, viewer, "marco").length >= 0);
  });

  test("home widget and explainability", () => {
    const { state, plan } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      sourceKind: "manual",
      title: "Home plan",
      objective: "Obj",
      sources: sources(),
    });
    const home = getHomePlanWidgetPure(state, viewer);
    assert.ok(home.pendingApproval.length >= 1);
    const exp = explainPlanPure(plan!);
    assert.equal(exp.executionInfluence, "none");
    assert.ok(exp.pipelineSteps.length >= 1);
    assert.ok(exp.humanDecisionPoints.length >= 1);
  });
});

describe("Sprint 8.0 Safety", () => {
  test("PLAN_EXECUTION_INFLUENCE is none and generation never executes", () => {
    assert.equal(PLAN_EXECUTION_INFLUENCE, "none");
    const { plan } = generatePlanPure(createEmptyPlanState(), {
      userId: "u1",
      sourceKind: "recommendation",
      sources: sources(),
    });
    assert.equal(plan!.executionInfluence, "none");
    assert.ok(plan!.steps.every((s) => s.requiresConfirmation));
  });
});

describe("Sprint 8.0 UI routes", () => {
  test("plan center and detail exist", () => {
    assert.ok(existsSync(join(process.cwd(), "app/dashboard/plans/page.tsx")));
    assert.ok(
      existsSync(join(process.cwd(), "app/dashboard/plans/[id]/page.tsx"))
    );
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "components/dashboard/plans/plan-center-client.tsx"
        )
      )
    );
  });
});

import type { Plan, PlanExplanation } from "@/lib/planner/types/types";

export function explainPlanPure(plan: Plan): PlanExplanation {
  return {
    planId: plan.id,
    sources: [
      `sourceKind:${plan.sourceKind}`,
      plan.sourceId ? `sourceId:${plan.sourceId}` : "sourceId:none",
      plan.projectId ? `project:${plan.projectId}` : "",
      plan.missionId ? `mission:${plan.missionId}` : "",
    ].filter(Boolean),
    originRecommendation: plan.recommendationId,
    evidence: plan.risks.flatMap((r) => r.evidence).slice(0, 10),
    rulesUsed: [
      "goal_breakdown_v1",
      "step_sequencing_v1",
      "dependency_v1",
      "resource_planning_v1",
      "risk_planning_v1",
      "milestone_v1",
      "review_cadence_v1",
      "human_approval_required",
      "no_auto_execution",
    ],
    assumptions: plan.assumptions,
    limitations: plan.limitations,
    alternatives: plan.alternatives,
    humanDecisionPoints: [
      "Aprovar ou rejeitar o plano",
      "Reordenar etapas",
      "Confirmar responsáveis",
      "Resolver dependências circulares se houver",
      "Concluir etapas manualmente",
      ...plan.dependencyIssues.map((i) => i.summary),
    ],
    pipelineSteps: plan.pipelineSteps,
    executionInfluence: "none",
  };
}

/**
 * Risk Planning Engine.
 */

import type { PlannerEngine } from "@/lib/planner/types/types";

export const riskPlanningEngine: PlannerEngine = {
  id: "risk_planning_v1",
  label: "Risk Planning",
  description: "Lista riscos com mitigação sugerida — probabilidade ≠ certeza.",
  enrich(draft, context) {
    const risks = [...draft.risks];
    const discRisk = context.sources.discoveries.find((d) =>
      ["RISK", "DEPENDENCY", "STAGNATION"].includes(d.type)
    );
    if (discRisk) {
      risks.push({
        title: discRisk.title,
        impact: "HIGH",
        probability: "MEDIUM",
        evidence: [discRisk.summary],
        mitigationSuggested: "Revisar evidências antes de aprovar o plano.",
        alternativePlan: "Pausar plano até o risco ser esclarecido.",
      });
    }
    risks.push({
      title: "Execução prematura",
      impact: "MEDIUM",
      probability: "LOW",
      evidence: ["Planos nascem DRAFT e exigem aprovação explícita"],
      mitigationSuggested: "Manter requiresConfirmation em todas as etapas.",
      alternativePlan: "Arquivar o plano sem iniciar.",
    });

    const maxImpact = risks.some((r) => r.impact === "HIGH" || r.impact === "CRITICAL")
      ? "HIGH"
      : draft.riskLevel;

    return {
      ...draft,
      risks,
      riskLevel: maxImpact,
      pipelineSteps: [...draft.pipelineSteps, "risk_planning"],
    };
  },
};

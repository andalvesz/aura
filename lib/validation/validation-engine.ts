import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import {
  buildValidationCriteria,
  VALIDATION_APPROVAL_THRESHOLD,
} from "@/lib/validation/validation-score";
import type { ValidationInsights, ValidationResult } from "@/lib/validation/validation-types";

export { VALIDATION_APPROVAL_THRESHOLD };

const CRITERIA_LABELS: Record<keyof Pick<ValidationInsights, "strengths" | "weaknesses" | "risks">, {
  field: keyof ValidationResult;
  label: string;
  strongAt: number;
  weakAt: number;
  riskAt: number;
  riskHighIsBad: boolean;
}[]> = {
  strengths: [
    { field: "marketConfidence", label: "Confiança de mercado sólida", strongAt: 75, weakAt: 55, riskAt: 0, riskHighIsBad: false },
    { field: "monetizationPotential", label: "Alto potencial de monetização", strongAt: 80, weakAt: 55, riskAt: 0, riskHighIsBad: false },
    { field: "marketTiming", label: "Timing favorável para lançamento", strongAt: 75, weakAt: 50, riskAt: 0, riskHighIsBad: false },
  ],
  weaknesses: [
    { field: "marketConfidence", label: "Demanda de mercado ainda incerta", strongAt: 75, weakAt: 55, riskAt: 0, riskHighIsBad: false },
    { field: "monetizationPotential", label: "Monetização limitada para a meta", strongAt: 80, weakAt: 55, riskAt: 0, riskHighIsBad: false },
    { field: "executionDifficulty", label: "Execução complexa para o estágio atual", strongAt: 0, weakAt: 0, riskAt: 0, riskHighIsBad: false },
  ],
  risks: [
    { field: "competitionRisk", label: "Concorrência agressiva no nicho", strongAt: 0, weakAt: 0, riskAt: 65, riskHighIsBad: true },
    { field: "executionDifficulty", label: "Dificuldade elevada de produção e lançamento", strongAt: 0, weakAt: 0, riskAt: 60, riskHighIsBad: true },
    { field: "marketTiming", label: "Timing de mercado desfavorável", strongAt: 75, weakAt: 45, riskAt: 0, riskHighIsBad: false },
  ],
};

function getFieldValue(result: ValidationResult, field: keyof ValidationResult): number {
  const value = result[field];
  return typeof value === "number" ? value : 0;
}

export function extractValidationInsights(result: ValidationResult): ValidationInsights {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];

  for (const item of CRITERIA_LABELS.strengths) {
    const value = getFieldValue(result, item.field);
    if (value >= item.strongAt) strengths.push(`${item.label} (${Math.round(value)}/100).`);
  }

  for (const item of CRITERIA_LABELS.weaknesses) {
    const value = getFieldValue(result, item.field);
    if (item.field === "executionDifficulty" && value >= 60) {
      weaknesses.push(`${item.label} (${Math.round(value)}/100).`);
    } else if (value > 0 && value <= item.weakAt) {
      weaknesses.push(`${item.label} (${Math.round(value)}/100).`);
    }
  }

  for (const item of CRITERIA_LABELS.risks) {
    const value = getFieldValue(result, item.field);
    if (item.field === "competitionRisk" || item.field === "executionDifficulty") {
      if (value >= item.riskAt) risks.push(`${item.label} (${Math.round(value)}/100).`);
    } else if (value <= item.weakAt) {
      risks.push(`${item.label} (${Math.round(value)}/100).`);
    }
  }

  if (result.validationScore < VALIDATION_APPROVAL_THRESHOLD) {
    risks.push(
      `Validation Score abaixo do mínimo exigido (${Math.round(result.validationScore)}/${VALIDATION_APPROVAL_THRESHOLD}).`
    );
  }

  return {
    strengths: strengths.length > 0 ? strengths : ["Nenhum ponto forte dominante identificado."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Nenhuma fraqueza crítica isolada."],
    risks: risks.length > 0 ? risks : ["Riscos dentro de limites aceitáveis."],
  };
}

function buildReasons(result: ValidationResult, insights: ValidationInsights): string[] {
  const reasons: string[] = [];

  if (result.approved) {
    reasons.push(...insights.strengths.slice(0, 3));
    if (result.competitionRisk >= 50) {
      reasons.push(`Atenção: concorrência moderada (${Math.round(result.competitionRisk)}/100).`);
    }
    return reasons;
  }

  reasons.push(...insights.weaknesses.filter((w) => !w.startsWith("Nenhuma")));
  reasons.push(...insights.risks.filter((r) => !r.startsWith("Riscos dentro")));
  return reasons.length > 0 ? reasons : ["Critérios de validação abaixo do patamar mínimo."];
}

export function validateOpportunity(opportunity: OpportunityRecommendation): ValidationResult {
  const criteria = buildValidationCriteria(opportunity);
  const approved = criteria.validationScore >= VALIDATION_APPROVAL_THRESHOLD;
  const draft: ValidationResult = {
    ...criteria,
    approved,
    recommendation: approved
      ? "Recomendo construir este produto."
      : "Não recomendo construir este produto.",
    reasons: [],
  };

  const insights = extractValidationInsights(draft);
  const reasons = buildReasons(draft, insights);

  if (!approved) {
    const topIssue = reasons[0] ?? "Validation Score insuficiente.";
    draft.recommendation = `Não recomendo construir este produto. ${topIssue}`;
  }

  return { ...draft, reasons };
}

export function isValidationApproved(result: ValidationResult): boolean {
  return result.approved && result.validationScore >= VALIDATION_APPROVAL_THRESHOLD;
}

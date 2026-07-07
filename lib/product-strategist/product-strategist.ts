import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ValidationResult } from "@/lib/validation/validation-types";
import {
  buildStrategyBlueprints,
  buildStrategyScores,
  getScalabilityLabel,
  getStrategyName,
} from "@/lib/product-strategist/product-strategist-score";
import type {
  ProductStrategistInput,
  ProductStrategistResult,
  ProductStrategyRecommendation,
  ProductStrategyType,
} from "@/lib/product-strategist/product-strategist-types";

const STRATEGY_LETTERS = ["A", "B", "C", "D", "E"] as const;

const MIN_STRATEGIES = 3;
const MAX_STRATEGIES = 5;

function strategyFitBonus(
  type: ProductStrategyType,
  opportunity: OpportunityRecommendation,
  validation: ValidationResult
): number {
  let bonus = 0;
  const { launchSpeed, ticket, scalability } = opportunity.opportunityScore;

  if (type === "kit_premium" && launchSpeed >= 70) bonus += 6;
  if (type === "curso_online" && ticket >= 70 && validation.monetizationPotential >= 75) bonus += 5;
  if (type === "comunidade" && scalability >= 75) bonus += 4;
  if (type === "mentoria" && validation.monetizationPotential >= 80 && ticket >= 65) bonus += 3;
  if (type === "desafio" && launchSpeed >= 65 && validation.marketTiming >= 70) bonus += 4;

  if (opportunity.recommendedProduct.toLowerCase().includes("curso") && type === "curso_online") {
    bonus += 2;
  }
  if (
    /kit|checklist|planner|guia|template/i.test(opportunity.recommendedProduct) &&
    type === "kit_premium"
  ) {
    bonus += 4;
  }

  return bonus;
}

function buildStrategyReason(
  type: ProductStrategyType,
  scores: ProductStrategyRecommendation["scores"],
  launchDays: number,
  margin: number
): string {
  const parts: string[] = [];

  if (scores.speed >= 85) parts.push(`pode ser lançada em ${launchDays} dias`);
  if (margin >= 95) parts.push(`margem de ${margin}%`);
  if (scores.scalability >= 80) parts.push("alta escalabilidade");
  if (scores.investment >= 85) parts.push("baixo investimento inicial");
  if (scores.revenue >= 80) parts.push("forte potencial de receita");

  const name = getStrategyName(type);
  if (parts.length === 0) {
    return `${name} equilibra receita e execução para este nicho.`;
  }
  return `${name}: ${parts.join(", ")}.`;
}

function buildRecommendationExplanation(
  chosen: ProductStrategyRecommendation,
  all: ProductStrategyRecommendation[]
): string {
  const lines: string[] = [`Recomendo a ${chosen.label} (${chosen.strategyName}).`];

  const fastest = [...all].sort((a, b) => a.estimatedLaunchTime - b.estimatedLaunchTime)[0];
  const highestMargin = [...all].sort((a, b) => b.estimatedMargin - a.estimatedMargin)[0];
  const lowestInvestment = [...all].sort((a, b) => a.estimatedCost - b.estimatedCost)[0];

  if (chosen.id === fastest?.id) {
    lines.push("Ela pode ser lançada em menos tempo.");
  } else if (chosen.estimatedLaunchTime <= 7) {
    lines.push(`Pode ser lançada em apenas ${chosen.estimatedLaunchTime} dias.`);
  }

  if (chosen.id === highestMargin?.id) {
    lines.push("Tem maior margem.");
  } else if (chosen.estimatedMargin >= 90) {
    lines.push(`Margem estimada de ${chosen.estimatedMargin}%.`);
  }

  if (chosen.id === lowestInvestment?.id) {
    lines.push("Exige menor investimento.");
  } else if (chosen.scores.investment >= 85) {
    lines.push("Investimento inicial reduzido.");
  }

  if (chosen.estimatedLaunchTime <= 7 || chosen.strategyType === "kit_premium") {
    lines.push("Permite validar rapidamente.");
  }

  if (chosen.ltvMonths) {
    lines.push(`LTV estimado em ${chosen.ltvMonths} meses.`);
  }

  return lines.join(" ");
}

export function runProductStrategist(input: ProductStrategistInput): ProductStrategistResult {
  const { validation, opportunity } = input;

  if (!validation.approved) {
    throw new Error("Product Strategist requer uma oportunidade validada e aprovada.");
  }

  const targetRevenue = Math.max(opportunity.estimatedProfit, opportunity.price * 30);
  const blueprints = buildStrategyBlueprints(opportunity, validation);

  const ranked = blueprints
    .map((blueprint) => {
      const scores = buildStrategyScores(blueprint, opportunity, validation, targetRevenue);
      const fitBonus = strategyFitBonus(blueprint.strategyType, opportunity, validation);
      const adjustedTotal = Math.min(100, scores.total + fitBonus);

      const draft: Omit<ProductStrategyRecommendation, "id" | "label"> = {
        strategyType: blueprint.strategyType,
        strategyName: getStrategyName(blueprint.strategyType),
        ticket: blueprint.ticket,
        ticketLabel: blueprint.ticketLabel,
        estimatedRevenue: blueprint.estimatedRevenue,
        estimatedCost: blueprint.estimatedCost,
        estimatedLaunchTime: blueprint.estimatedLaunchTime,
        estimatedMargin: blueprint.estimatedMargin,
        estimatedROI: blueprint.estimatedROI,
        ltvMonths: blueprint.ltvMonths,
        scalabilityLabel: getScalabilityLabel(blueprint.strategyType),
        scores: { ...scores, total: adjustedTotal },
        reason: buildStrategyReason(
          blueprint.strategyType,
          scores,
          blueprint.estimatedLaunchTime,
          blueprint.estimatedMargin
        ),
      };

      return draft;
    })
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, MAX_STRATEGIES);

  const strategyCount = Math.max(MIN_STRATEGIES, Math.min(MAX_STRATEGIES, ranked.length));
  const selected = ranked.slice(0, strategyCount);

  const strategies: ProductStrategyRecommendation[] = selected.map((item, index) => ({
    ...item,
    id: STRATEGY_LETTERS[index]!,
    label: `Estratégia ${STRATEGY_LETTERS[index]}`,
  }));

  const recommendation = strategies[0]!;
  const explanation = buildRecommendationExplanation(recommendation, strategies);

  return {
    strategies,
    recommendation,
    explanation,
  };
}

export function strategizeProduct(
  opportunity: OpportunityRecommendation,
  validation: ValidationResult
): ProductStrategistResult {
  return runProductStrategist({ opportunity, validation });
}

import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ValidationResult } from "@/lib/validation/validation-types";
import type {
  ProductStrategyScores,
  ProductStrategyType,
} from "@/lib/product-strategist/product-strategist-types";

const TOTAL_WEIGHTS = {
  revenue: 0.3,
  execution: 0.15,
  scalability: 0.2,
  speed: 0.2,
  investment: 0.15,
} as const;

const STRATEGY_NAMES: Record<ProductStrategyType, string> = {
  curso_online: "Curso Online",
  kit_premium: "Kit Premium",
  comunidade: "Comunidade",
  mentoria: "Mentoria",
  desafio: "Desafio",
};

const STRATEGY_SCALABILITY: Record<ProductStrategyType, string> = {
  curso_online: "Alta",
  kit_premium: "Muito Alta",
  comunidade: "Alta",
  mentoria: "Média",
  desafio: "Alta",
};

export type StrategyBlueprint = {
  strategyType: ProductStrategyType;
  ticket: number;
  ticketLabel: string;
  estimatedRevenue: number;
  estimatedCost: number;
  estimatedLaunchTime: number;
  estimatedMargin: number;
  estimatedROI: number;
  ltvMonths?: number;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundMoney(value: number): number {
  return Math.round(value);
}

export function getStrategyName(type: ProductStrategyType): string {
  return STRATEGY_NAMES[type];
}

export function getScalabilityLabel(type: ProductStrategyType): string {
  return STRATEGY_SCALABILITY[type];
}

export function computeRevenueScore(
  estimatedRevenue: number,
  targetRevenue: number
): number {
  if (targetRevenue <= 0) return 50;
  const ratio = estimatedRevenue / targetRevenue;
  if (ratio >= 1.2) return 95;
  if (ratio >= 1) return 88;
  if (ratio >= 0.8) return 75;
  if (ratio >= 0.6) return 60;
  return roundScore(clamp(ratio * 80));
}

export function computeExecutionScore(
  validation: ValidationResult,
  launchDays: number
): number {
  const ease = 100 - validation.executionDifficulty;
  const timePenalty = launchDays <= 4 ? 8 : launchDays <= 7 ? 4 : launchDays <= 12 ? 0 : -8;
  return roundScore(clamp(ease * 0.7 + validation.marketConfidence * 0.2 + 50 * 0.1 + timePenalty));
}

export function computeScalabilityScore(
  opportunity: OpportunityRecommendation,
  strategyType: ProductStrategyType
): number {
  const base = opportunity.opportunityScore.scalability;
  const bonus: Record<ProductStrategyType, number> = {
    kit_premium: 12,
    curso_online: 6,
    comunidade: 8,
    desafio: 4,
    mentoria: -10,
  };
  return roundScore(clamp(base + bonus[strategyType]));
}

export function computeSpeedScore(launchDays: number): number {
  if (launchDays <= 3) return 98;
  if (launchDays <= 5) return 92;
  if (launchDays <= 7) return 85;
  if (launchDays <= 10) return 75;
  if (launchDays <= 14) return 65;
  return roundScore(clamp(100 - launchDays * 2.5));
}

export function computeInvestmentScore(estimatedCost: number, estimatedRevenue: number): number {
  if (estimatedRevenue <= 0) return 50;
  const costRatio = estimatedCost / estimatedRevenue;
  if (costRatio <= 0.01) return 98;
  if (costRatio <= 0.03) return 92;
  if (costRatio <= 0.05) return 85;
  if (costRatio <= 0.1) return 72;
  if (costRatio <= 0.2) return 58;
  return roundScore(clamp(100 - costRatio * 200));
}

export function computeStrategyTotalScore(scores: Omit<ProductStrategyScores, "total">): number {
  const total =
    scores.revenue * TOTAL_WEIGHTS.revenue +
    scores.execution * TOTAL_WEIGHTS.execution +
    scores.scalability * TOTAL_WEIGHTS.scalability +
    scores.speed * TOTAL_WEIGHTS.speed +
    scores.investment * TOTAL_WEIGHTS.investment;

  return roundScore(clamp(total));
}

export function buildStrategyScores(
  blueprint: StrategyBlueprint,
  opportunity: OpportunityRecommendation,
  validation: ValidationResult,
  targetRevenue: number
): ProductStrategyScores {
  const partial = {
    revenue: computeRevenueScore(blueprint.estimatedRevenue, targetRevenue),
    execution: computeExecutionScore(validation, blueprint.estimatedLaunchTime),
    scalability: computeScalabilityScore(opportunity, blueprint.strategyType),
    speed: computeSpeedScore(blueprint.estimatedLaunchTime),
    investment: computeInvestmentScore(blueprint.estimatedCost, blueprint.estimatedRevenue),
  };

  return {
    ...partial,
    total: computeStrategyTotalScore(partial),
  };
}

function estimateSalesNeeded(opportunity: OpportunityRecommendation): number {
  if (opportunity.price <= 0) return 100;
  return Math.max(10, Math.round(opportunity.estimatedProfit / opportunity.price));
}

export function buildStrategyBlueprints(
  opportunity: OpportunityRecommendation,
  validation: ValidationResult
): StrategyBlueprint[] {
  const basePrice = opportunity.price;
  const targetRevenue = Math.max(opportunity.estimatedProfit, basePrice * 30);
  const salesNeeded = estimateSalesNeeded(opportunity);
  const demandBoost = validation.marketConfidence >= 75 ? 1.1 : 1;
  const speedBoost = opportunity.opportunityScore.launchSpeed >= 75;

  const cursoTicket = roundMoney(basePrice * (validation.monetizationPotential >= 80 ? 1.1 : 0.85));
  const kitTicket = roundMoney(Math.max(47, basePrice * 0.35));
  const comunidadeTicket = roundMoney(Math.max(29, basePrice * 0.18));
  const mentoriaTicket = roundMoney(basePrice * (validation.monetizationPotential >= 70 ? 2.8 : 2.2));
  const desafioTicket = roundMoney(Math.max(67, basePrice * 0.55));

  const cursoRevenue = roundMoney(cursoTicket * salesNeeded * 0.85 * demandBoost);
  const kitRevenue = roundMoney(kitTicket * salesNeeded * 1.4 * demandBoost);
  const comunidadeLtv = 12;
  const comunidadeSubs = Math.max(20, Math.round(salesNeeded * 0.35));
  const comunidadeRevenue = roundMoney(comunidadeTicket * comunidadeSubs * comunidadeLtv * 0.7);
  const mentoriaRevenue = roundMoney(mentoriaTicket * Math.max(4, Math.round(salesNeeded * 0.08)) * demandBoost);
  const desafioRevenue = roundMoney(desafioTicket * salesNeeded * 1.1 * demandBoost);

  const blueprints: StrategyBlueprint[] = [
    {
      strategyType: "curso_online",
      ticket: cursoTicket,
      ticketLabel: `R$ ${cursoTicket.toLocaleString("pt-BR")}`,
      estimatedRevenue: cursoRevenue,
      estimatedCost: roundMoney(cursoRevenue * 0.05),
      estimatedLaunchTime: speedBoost ? 10 : 12,
      estimatedMargin: 95,
      estimatedROI: roundScore(cursoRevenue / Math.max(cursoRevenue * 0.05, 1)),
    },
    {
      strategyType: "kit_premium",
      ticket: kitTicket,
      ticketLabel: `R$ ${kitTicket.toLocaleString("pt-BR")}`,
      estimatedRevenue: kitRevenue,
      estimatedCost: roundMoney(kitRevenue * 0.01),
      estimatedLaunchTime: 3,
      estimatedMargin: 99,
      estimatedROI: roundScore(kitRevenue / Math.max(kitRevenue * 0.01, 1)),
    },
    {
      strategyType: "comunidade",
      ticket: comunidadeTicket,
      ticketLabel: `R$ ${comunidadeTicket.toLocaleString("pt-BR")}/mês`,
      estimatedRevenue: comunidadeRevenue,
      estimatedCost: roundMoney(comunidadeRevenue * 0.08),
      estimatedLaunchTime: 8,
      estimatedMargin: 92,
      estimatedROI: roundScore(comunidadeRevenue / Math.max(comunidadeRevenue * 0.08, 1)),
      ltvMonths: comunidadeLtv,
    },
    {
      strategyType: "mentoria",
      ticket: mentoriaTicket,
      ticketLabel: `R$ ${mentoriaTicket.toLocaleString("pt-BR")}`,
      estimatedRevenue: mentoriaRevenue,
      estimatedCost: roundMoney(mentoriaRevenue * 0.12),
      estimatedLaunchTime: 16,
      estimatedMargin: 88,
      estimatedROI: roundScore(mentoriaRevenue / Math.max(mentoriaRevenue * 0.12, 1)),
    },
    {
      strategyType: "desafio",
      ticket: desafioTicket,
      ticketLabel: `R$ ${desafioTicket.toLocaleString("pt-BR")}`,
      estimatedRevenue: desafioRevenue,
      estimatedCost: roundMoney(desafioRevenue * 0.03),
      estimatedLaunchTime: speedBoost ? 5 : 7,
      estimatedMargin: 96,
      estimatedROI: roundScore(desafioRevenue / Math.max(desafioRevenue * 0.03, 1)),
    },
  ];

  return blueprints;
}

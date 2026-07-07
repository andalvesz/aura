import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ValidationResult } from "@/lib/validation/validation-types";

export const VALIDATION_APPROVAL_THRESHOLD = 85;

const WEIGHTS = {
  marketConfidence: 0.25,
  monetizationPotential: 0.25,
  marketTiming: 0.15,
  lowCompetitionRisk: 0.2,
  lowExecutionDifficulty: 0.15,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeMarketConfidence(opportunity: OpportunityRecommendation): number {
  const { demand, scalability, margin } = opportunity.opportunityScore;
  return roundScore(clamp(demand * 0.45 + scalability * 0.35 + margin * 0.2));
}

export function computeCompetitionRisk(opportunity: OpportunityRecommendation): number {
  const competitionAdvantage = opportunity.opportunityScore.competition;
  const uniquenessBuffer = opportunity.uniquenessScore * 0.25;
  const risk = 100 - competitionAdvantage * 0.75 - uniquenessBuffer;
  return roundScore(clamp(risk));
}

export function computeExecutionDifficulty(opportunity: OpportunityRecommendation): number {
  const { production, launchSpeed } = opportunity.opportunityScore;
  const ease = (production + launchSpeed) / 2;
  const investmentPenalty = opportunity.investmentScore < 50 ? 12 : 0;
  return roundScore(clamp(100 - ease + investmentPenalty));
}

export function computeMonetizationPotential(opportunity: OpportunityRecommendation): number {
  const { ticket, margin, demand } = opportunity.opportunityScore;
  const profitSignal = opportunity.estimatedProfit >= 10000 ? 18 : opportunity.estimatedProfit >= 5000 ? 10 : 0;
  return roundScore(clamp(ticket * 0.35 + margin * 0.35 + demand * 0.2 + profitSignal));
}

export function computeMarketTiming(opportunity: OpportunityRecommendation): number {
  const { launchSpeed, demand, scalability } = opportunity.opportunityScore;
  const opportunityMomentum = opportunity.opportunityScore.total * 0.2;
  return roundScore(clamp(launchSpeed * 0.4 + demand * 0.25 + scalability * 0.15 + opportunityMomentum));
}

export function computeValidationScore(criteria: {
  marketConfidence: number;
  competitionRisk: number;
  executionDifficulty: number;
  monetizationPotential: number;
  marketTiming: number;
}): number {
  const total =
    criteria.marketConfidence * WEIGHTS.marketConfidence +
    criteria.monetizationPotential * WEIGHTS.monetizationPotential +
    criteria.marketTiming * WEIGHTS.marketTiming +
    (100 - criteria.competitionRisk) * WEIGHTS.lowCompetitionRisk +
    (100 - criteria.executionDifficulty) * WEIGHTS.lowExecutionDifficulty;

  return roundScore(clamp(total));
}

export function buildValidationCriteria(
  opportunity: OpportunityRecommendation
): Omit<ValidationResult, "approved" | "recommendation" | "reasons"> {
  const marketConfidence = computeMarketConfidence(opportunity);
  const competitionRisk = computeCompetitionRisk(opportunity);
  const executionDifficulty = computeExecutionDifficulty(opportunity);
  const monetizationPotential = computeMonetizationPotential(opportunity);
  const marketTiming = computeMarketTiming(opportunity);
  const validationScore = computeValidationScore({
    marketConfidence,
    competitionRisk,
    executionDifficulty,
    monetizationPotential,
    marketTiming,
  });

  return {
    validationScore,
    marketConfidence,
    executionDifficulty,
    competitionRisk,
    marketTiming,
    monetizationPotential,
  };
}

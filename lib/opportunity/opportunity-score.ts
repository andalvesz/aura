import type { DigitalNiche, OpportunityScore, ParsedGoal } from "@/lib/opportunity/opportunity-types";

const WEIGHTS = {
  demand: 0.2,
  competition: 0.15,
  ticket: 0.15,
  production: 0.15,
  launchSpeed: 0.1,
  scalability: 0.15,
  margin: 0.1,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function ticketMidpoint(niche: DigitalNiche): number {
  return (niche.ticketRange.min + niche.ticketRange.max) / 2;
}

function scoreDemand(niche: DigitalNiche): number {
  return clamp(niche.marketSize);
}

function scoreCompetition(niche: DigitalNiche): number {
  return clamp(100 - niche.competition);
}

function scoreTicket(niche: DigitalNiche, goal?: ParsedGoal): number {
  const midpoint = ticketMidpoint(niche);
  if (!goal || goal.monthlyRevenue <= 0) {
    return clamp((midpoint / 500) * 50 + 25);
  }

  const salesNeeded = goal.monthlyRevenue / midpoint;
  const volumeFit = salesNeeded <= 30 ? 100 : salesNeeded <= 100 ? 80 : salesNeeded <= 300 ? 60 : 40;
  const ticketFit = midpoint >= 47 && midpoint <= 997 ? 90 : midpoint > 997 ? 75 : 65;

  return clamp((volumeFit + ticketFit) / 2);
}

function scoreProduction(niche: DigitalNiche): number {
  return clamp(100 - niche.difficulty);
}

function scoreLaunchSpeed(niche: DigitalNiche): number {
  const base = 100 - niche.difficulty * 0.7 - niche.competition * 0.1;
  const productBonus = niche.digitalProducts.some((p) =>
    /template|checklist|guia|planner/i.test(p)
  )
    ? 12
    : 0;
  return clamp(base + productBonus);
}

function scoreScalability(niche: DigitalNiche): number {
  const marketFactor = niche.marketSize * 0.6;
  const digitalFactor = niche.digitalProducts.length >= 3 ? 25 : 15;
  return clamp(marketFactor + digitalFactor);
}

function scoreMargin(niche: DigitalNiche): number {
  const baseMargin = 85 - niche.difficulty * 0.15;
  const servicePenalty = niche.digitalProducts.some((p) => /mentoria|consultoria/i.test(p))
    ? 10
    : 0;
  return clamp(baseMargin - servicePenalty);
}

function computeTotal(scores: Omit<OpportunityScore, "total">): number {
  const total =
    scores.demand * WEIGHTS.demand +
    scores.competition * WEIGHTS.competition +
    scores.ticket * WEIGHTS.ticket +
    scores.production * WEIGHTS.production +
    scores.launchSpeed * WEIGHTS.launchSpeed +
    scores.scalability * WEIGHTS.scalability +
    scores.margin * WEIGHTS.margin;

  return roundScore(total);
}

export function computeNicheOpportunityScore(
  niche: DigitalNiche,
  goal?: ParsedGoal
): OpportunityScore {
  const demand = roundScore(scoreDemand(niche));
  const competition = roundScore(scoreCompetition(niche));
  const ticket = roundScore(scoreTicket(niche, goal));
  const production = roundScore(scoreProduction(niche));
  const launchSpeed = roundScore(scoreLaunchSpeed(niche));
  const scalability = roundScore(scoreScalability(niche));
  const margin = roundScore(scoreMargin(niche));

  const partial = { demand, competition, ticket, production, launchSpeed, scalability, margin };
  return { ...partial, total: computeTotal(partial) };
}

export function computeInvestmentScore(niche: DigitalNiche): number {
  const productionEase = 100 - niche.difficulty;
  const lowCompetitionBonus = niche.competition < 50 ? 15 : 0;
  return clamp((productionEase + lowCompetitionBonus) / 1.15);
}

export function computeUniquenessScore(niche: DigitalNiche): number {
  const specificity = niche.problem.length > 60 ? 20 : 10;
  const productVariety = Math.min(30, niche.digitalProducts.length * 8);
  const competitionInverse = (100 - niche.competition) * 0.5;
  return clamp(specificity + productVariety + competitionInverse);
}

export function goalFitBonus(niche: DigitalNiche, goal: ParsedGoal): number {
  const midpoint = ticketMidpoint(niche);
  if (midpoint <= 0) return 0;

  const salesNeeded = goal.monthlyRevenue / midpoint;
  if (salesNeeded <= 50) return 8;
  if (salesNeeded <= 150) return 4;
  if (salesNeeded <= 400) return 0;
  return -6;
}

import { DIGITAL_NICHES } from "@/lib/opportunity/opportunity-dataset";
import { computeNicheIntentMatch, parseOpportunityIntent } from "@/lib/opportunity/opportunity-intent";
import {
  computeInvestmentScore,
  computeNicheOpportunityScore,
  computeUniquenessScore,
  goalFitBonus,
} from "@/lib/opportunity/opportunity-score";
import type {
  BusinessReasoningSummary,
  DigitalNiche,
  OpportunityEngineResult,
  OpportunityIntent,
  OpportunityRecommendation,
  ParsedGoal,
} from "@/lib/opportunity/opportunity-types";
import {
  buildOpportunityAngles,
  runBusinessReasoning,
  type BusinessModel,
  type BusinessProblem,
  type ScoredOpportunityAngle,
} from "@/utils/business-reasoning";
import { enrichOpportunityResults, defaultDecisionFields } from "@/utils/decision-explainer";

const GOAL_REVENUE_PATTERNS = [
  /(?:ganhar|faturar|receber|lucre|lucrar|atingir|meta\s+de)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/i,
  /r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:por\s*m[eê]s|mensal|\/m[eê]s)/i,
  /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:per\s*month|monthly|\/month)/i,
  /(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:reais?\s*)?(?:por\s*m[eê]s|mensal)/i,
];

function parseRevenueNumber(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function parseGoal(goal: string): ParsedGoal {
  const trimmed = goal.trim();
  let monthlyRevenue = 0;
  let currency: ParsedGoal["currency"] = "BRL";

  for (const pattern of GOAL_REVENUE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      monthlyRevenue = parseRevenueNumber(match[1]);
      if (pattern.source.includes("\\$") && !pattern.source.includes("r\\$")) {
        currency = "USD";
      }
      break;
    }
  }

  if (monthlyRevenue === 0) {
    monthlyRevenue = 10000;
  }

  return { raw: trimmed, monthlyRevenue, currency };
}

function pickNicheForAngle(angle: ScoredOpportunityAngle, intent: OpportunityIntent): DigitalNiche {
  const candidates = DIGITAL_NICHES.filter((n) => angle.nicheIds.includes(n.id));
  if (candidates.length === 0) {
    return DIGITAL_NICHES.find((n) => n.id === "empreendedorismo") ?? DIGITAL_NICHES[0]!;
  }

  return candidates
    .map((niche) => ({
      niche,
      match: computeNicheIntentMatch(niche, intent),
    }))
    .sort((a, b) => b.match - a.match)[0]!.niche;
}

function pickPriceForModel(model: BusinessModel, goal: ParsedGoal): number {
  const midpoint = Math.round((model.ticketRange.min + model.ticketRange.max) / 2);
  const salesNeeded = goal.monthlyRevenue / midpoint;

  if (salesNeeded > 80) return model.ticketRange.min;
  if (salesNeeded < 20) return model.ticketRange.max;
  return midpoint;
}

function productLabelForModel(model: BusinessModel, problem: BusinessProblem, niche: DigitalNiche): string {
  const labels: Record<string, string> = {
    curso: `Curso — ${problem.label}`,
    mentoria: `Mentoria — ${problem.label}`,
    comunidade: `Comunidade — ${problem.label}`,
    kit: `Kit digital — ${problem.label}`,
    templates: `Pack de templates — ${problem.label}`,
    consultoria: `Consultoria — ${problem.label}`,
    servico: `Serviço — ${problem.label}`,
    agencia: `Agência — ${problem.label}`,
    saas: `Plataforma SaaS — ${problem.label}`,
    automacao: `Automação — ${problem.label}`,
    assinatura: `Assinatura — ${problem.label}`,
    licenciamento: `Licenciamento — ${problem.label}`,
    marketplace: `Marketplace — ${problem.label}`,
    "ferramenta-ia": `Ferramenta IA — ${problem.label}`,
  };

  return labels[model.id] ?? `${model.label} — ${niche.name}`;
}

function buildReason(
  angle: ScoredOpportunityAngle,
  niche: DigitalNiche,
  score: number,
  goal: ParsedGoal,
  price: number
): string {
  const sales = Math.ceil(goal.monthlyRevenue / price);
  return (
    `Score ${Math.round(score)} — ${angle.justification} ` +
    `Problema: ${angle.problem.label}. Modelo: ${angle.businessModel.label}. ` +
    `Ticket R$${price.toLocaleString("pt-BR")} · ~${sales} vendas/mês para R$${goal.monthlyRevenue.toLocaleString("pt-BR")}.`
  );
}

function toRecommendation(
  angle: ScoredOpportunityAngle,
  niche: DigitalNiche,
  goal: ParsedGoal,
  intent: OpportunityIntent,
  reasoning: BusinessReasoningSummary
): OpportunityRecommendation {
  const intentMatch = computeNicheIntentMatch(niche, intent);
  const opportunityScore = computeNicheOpportunityScore(niche, goal);
  const marketAdjusted = opportunityScore.total + goalFitBonus(niche, goal);
  const problemWeight = angle.problemScore * 0.4;
  const modelWeight = angle.modelScore * 0.35;
  const marketWeight = marketAdjusted * 0.25;
  const finalTotal = Math.round((problemWeight + modelWeight + marketWeight) * 100) / 100;

  const price = pickPriceForModel(angle.businessModel, goal);
  const estimatedSales = Math.ceil(goal.monthlyRevenue / price);
  const estimatedProfit = Math.round(price * estimatedSales * 0.75);
  const recommendedProduct = productLabelForModel(angle.businessModel, angle.problem, niche);

  return {
    title: `${recommendedProduct} · ${niche.name}`,
    niche: niche.name,
    avatar: reasoning.avatar ?? niche.avatar,
    problem: angle.problem.label,
    market: reasoning.market,
    technology: reasoning.technology,
    businessModel: angle.businessModel.label,
    confidence: reasoning.confidence,
    recommendedProduct,
    price,
    opportunityScore: { ...opportunityScore, total: finalTotal },
    intentMatchScore: Math.round(intentMatch),
    estimatedProfit,
    investmentScore: Math.round(computeInvestmentScore(niche)),
    uniquenessScore: Math.round(computeUniquenessScore(niche)),
    reason: buildReason(angle, niche, finalTotal, goal, price),
    ...defaultDecisionFields(),
  };
}

function toReasoningSummary(
  reasoning: ReturnType<typeof runBusinessReasoning>
): BusinessReasoningSummary {
  return {
    raw: reasoning.raw,
    financialGoal: reasoning.financialGoal,
    technology: reasoning.technology,
    market: reasoning.market,
    avatar: reasoning.avatar,
    problems: reasoning.problems,
    primaryProblem: reasoning.primaryProblem,
    urgency: reasoning.urgency,
    deadline: reasoning.deadline,
    desiredBusinessModel: reasoning.desiredBusinessModel,
    recommendedBusinessModel: reasoning.recommendedBusinessModel,
    businessModelJustification: reasoning.businessModelJustification,
    confidence: reasoning.confidence,
  };
}

export function runOpportunityEngine(goal: string): OpportunityEngineResult {
  const parsedGoal = parseGoal(goal);
  const reasoning = runBusinessReasoning(goal);
  const reasoningSummary = toReasoningSummary(reasoning);
  const intent = parseOpportunityIntent(goal, parsedGoal.monthlyRevenue !== 10000);

  const angles = buildOpportunityAngles(reasoning);
  const rawRecommendations = angles
    .slice(0, 3)
    .map((angle) => {
      const niche = pickNicheForAngle(angle, intent);
      return toRecommendation(angle, niche, parsedGoal, intent, reasoningSummary);
    })
    .sort((a, b) => b.opportunityScore.total - a.opportunityScore.total);

  const { recommendations, comparison, recommendationSummary } = enrichOpportunityResults(
    rawRecommendations,
    parsedGoal,
    reasoningSummary
  );

  return {
    goal: parsedGoal,
    intent,
    reasoning: reasoningSummary,
    recommendations,
    comparison,
    recommendationSummary,
    totalCandidates: angles.length,
  };
}

export function getTopOpportunities(goal: string, limit = 3): OpportunityRecommendation[] {
  return runOpportunityEngine(goal).recommendations.slice(0, limit);
}

export { parseOpportunityIntent } from "@/lib/opportunity/opportunity-intent";
export { runBusinessReasoning } from "@/utils/business-reasoning";

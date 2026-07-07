import { DIGITAL_NICHES } from "@/lib/opportunity/opportunity-dataset";
import {
  computeInvestmentScore,
  computeNicheOpportunityScore,
  computeUniquenessScore,
  goalFitBonus,
} from "@/lib/opportunity/opportunity-score";
import type {
  DigitalNiche,
  OpportunityEngineResult,
  OpportunityRecommendation,
  ParsedGoal,
} from "@/lib/opportunity/opportunity-types";

const GOAL_REVENUE_PATTERNS = [
  /(?:ganhar|faturar|receber|lucre|lucrar|atingir|meta\s+de)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/i,
  /r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:por\s*m[eê]s|mensal|\/m[eê]s)/i,
  /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:per\s*month|monthly|\/month)/i,
  /(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:reais?\s*)?(?:por\s*m[eê]s|mensal)/i,
];

const NICHE_KEYWORDS: Record<string, string[]> = {
  ia: ["ia", "inteligência artificial", "inteligencia artificial", "chatgpt", "automação"],
  produtividade: ["produtividade", "produtivo", "organização", "organizacao"],
  "marketing-digital": ["marketing", "tráfego", "trafego", "digital"],
  copywriting: ["copy", "copywriting", "texto de venda"],
  instagram: ["instagram", "reels", "stories"],
  youtube: ["youtube", "canal"],
  excel: ["excel", "planilha"],
  "power-bi": ["power bi", "powerbi", "bi"],
  "financas-pessoais": ["finanças", "financas", "dinheiro", "orçamento"],
  investimentos: ["investimento", "investir", "bolsa", "ações"],
  emagrecimento: ["emagrecer", "emagrecimento", "dieta", "peso"],
  musculacao: ["musculação", "musculacao", "hipertrofia", "treino"],
  nutricao: ["nutrição", "nutricao", "alimentação"],
  relacionamentos: ["relacionamento", "namoro", "casal"],
  ingles: ["inglês", "ingles", "english"],
  concursos: ["concurso", "concurseiro"],
  tdah: ["tdah", "déficit de atenção"],
  autismo: ["autismo", "tea", "espectro"],
  fotografia: ["fotografia", "foto"],
  "design-grafico": ["design", "canva"],
  arquitetura: ["arquitetura", "arquiteto"],
  direito: ["direito", "advogado", "jurídico"],
  odontologia: ["odontologia", "dentista"],
  medicos: ["médico", "medico", "medicina"],
  farmacia: ["farmácia", "farmacia", "farmacêutico"],
  contabilidade: ["contabilidade", "contador"],
  imobiliaria: ["imobiliária", "imobiliaria", "corretor"],
  "energia-solar": ["energia solar", "solar", "fotovoltaico"],
  consorcio: ["consórcio", "consorcio"],
  estetica: ["estética", "estetica", "beleza"],
};

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

function nicheMatchesGoalText(niche: DigitalNiche, goalText: string): boolean {
  const lower = goalText.toLowerCase();
  const keywords = NICHE_KEYWORDS[niche.id] ?? [niche.name.toLowerCase()];
  return keywords.some((kw) => lower.includes(kw));
}

function isNicheCompatible(niche: DigitalNiche, goal: ParsedGoal): boolean {
  const midpoint = (niche.ticketRange.min + niche.ticketRange.max) / 2;
  if (midpoint <= 0) return false;

  const salesNeeded = goal.monthlyRevenue / midpoint;
  return salesNeeded <= 2000;
}

function pickRecommendedProduct(niche: DigitalNiche, goal: ParsedGoal): string {
  const midpoint = (niche.ticketRange.min + niche.ticketRange.max) / 2;
  const salesNeeded = goal.monthlyRevenue / midpoint;

  if (salesNeeded > 100) {
    const lowTicket = niche.digitalProducts.find((p) =>
      /planner|checklist|guia|template|planilha|e-book/i.test(p)
    );
    if (lowTicket) return lowTicket;
  }

  if (salesNeeded < 30) {
    const highTicket = niche.digitalProducts.find((p) =>
      /curso|programa|mentoria|bootcamp|formação/i.test(p)
    );
    if (highTicket) return highTicket;
  }

  return niche.digitalProducts[0] ?? `Programa digital de ${niche.name}`;
}

function pickPrice(niche: DigitalNiche, goal: ParsedGoal): number {
  const midpoint = Math.round((niche.ticketRange.min + niche.ticketRange.max) / 2);
  const salesNeeded = goal.monthlyRevenue / midpoint;

  if (salesNeeded > 80) {
    return niche.ticketRange.min;
  }
  if (salesNeeded < 20) {
    return niche.ticketRange.max;
  }
  return midpoint;
}

function buildReason(niche: DigitalNiche, score: number, goal: ParsedGoal): string {
  const price = pickPrice(niche, goal);
  const sales = Math.ceil(goal.monthlyRevenue / price);
  const parts: string[] = [];

  if (niche.marketSize >= 85) {
    parts.push("alta demanda de mercado");
  }
  if (niche.competition < 55) {
    parts.push("concorrência moderada");
  }
  if (niche.difficulty < 45) {
    parts.push("produção relativamente rápida");
  }

  const reasonCore =
    parts.length > 0
      ? parts.join(", ")
      : "equilíbrio entre demanda e viabilidade";

  return `Score ${Math.round(score)} — ${reasonCore}. Com ticket de R$${price.toLocaleString("pt-BR")}, são ~${sales} vendas/mês para atingir R$${goal.monthlyRevenue.toLocaleString("pt-BR")}.`;
}

function toRecommendation(niche: DigitalNiche, goal: ParsedGoal): OpportunityRecommendation {
  const opportunityScore = computeNicheOpportunityScore(niche, goal);
  const adjustedTotal = opportunityScore.total + goalFitBonus(niche, goal);
  const finalScore = {
    ...opportunityScore,
    total: Math.round(adjustedTotal * 100) / 100,
  };

  const price = pickPrice(niche, goal);
  const estimatedSales = Math.ceil(goal.monthlyRevenue / price);
  const estimatedProfit = Math.round(price * estimatedSales * 0.75);

  const recommendedProduct = pickRecommendedProduct(niche, goal);

  return {
    title: `${recommendedProduct} — ${niche.name}`,
    niche: niche.name,
    avatar: niche.avatar,
    problem: niche.problem,
    recommendedProduct,
    price,
    opportunityScore: finalScore,
    estimatedProfit,
    investmentScore: Math.round(computeInvestmentScore(niche)),
    uniquenessScore: Math.round(computeUniquenessScore(niche)),
    reason: buildReason(niche, finalScore.total, goal),
  };
}

export function selectCompatibleNiches(goal: ParsedGoal, goalText: string): DigitalNiche[] {
  const textMatches = DIGITAL_NICHES.filter((n) => nicheMatchesGoalText(n, goalText));

  const compatible = DIGITAL_NICHES.filter((n) => isNicheCompatible(n, goal));

  if (textMatches.length > 0) {
    const matchIds = new Set(textMatches.map((n) => n.id));
    const combined = [
      ...textMatches,
      ...compatible.filter((n) => !matchIds.has(n.id)),
    ];
    return combined;
  }

  return compatible;
}

export function rankOpportunities(
  niches: DigitalNiche[],
  goal: ParsedGoal
): OpportunityRecommendation[] {
  return niches
    .map((niche) => toRecommendation(niche, goal))
    .sort((a, b) => b.opportunityScore.total - a.opportunityScore.total);
}

export function runOpportunityEngine(goal: string): OpportunityEngineResult {
  const parsedGoal = parseGoal(goal);
  const candidates = selectCompatibleNiches(parsedGoal, goal);
  const ranked = rankOpportunities(candidates, parsedGoal);
  const recommendations = ranked.slice(0, 3);

  return {
    goal: parsedGoal,
    recommendations,
    totalCandidates: candidates.length,
  };
}

export function getTopOpportunities(goal: string, limit = 3): OpportunityRecommendation[] {
  return runOpportunityEngine(goal).recommendations.slice(0, limit);
}

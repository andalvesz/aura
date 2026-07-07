export type OpportunityScore = {
  demand: number;
  competition: number;
  ticket: number;
  production: number;
  launchSpeed: number;
  scalability: number;
  margin: number;
  total: number;
};

export type DigitalNiche = {
  id: string;
  name: string;
  avatar: string;
  problem: string;
  marketSize: number;
  ticketRange: { min: number; max: number };
  difficulty: number;
  competition: number;
  examples: string[];
  digitalProducts: string[];
};

export type ParsedGoal = {
  raw: string;
  monthlyRevenue: number;
  currency: "BRL" | "USD";
};

export type OpportunityIntent = {
  raw: string;
  niche: string | null;
  technology: string | null;
  avatar: string | null;
  market: string | null;
  problem: string | null;
  matchedNicheIds: string[];
  primaryNicheIds: string[];
  confidence: number;
  explicitNiche: boolean;
};

export type OpportunityRecommendation = {
  title: string;
  niche: string;
  avatar: string;
  problem: string;
  market: string | null;
  technology: string | null;
  businessModel: string;
  confidence: number;
  recommendedProduct: string;
  price: number;
  opportunityScore: OpportunityScore;
  intentMatchScore: number;
  estimatedProfit: number;
  investmentScore: number;
  uniquenessScore: number;
  reason: string;
};

export type BusinessReasoningSummary = {
  raw: string;
  financialGoal: { monthlyRevenue: number; currency: "BRL" | "USD" };
  technology: string | null;
  market: string | null;
  avatar: string | null;
  problems: string[];
  primaryProblem: string;
  urgency: string | null;
  deadline: string | null;
  desiredBusinessModel: string | null;
  recommendedBusinessModel: string;
  businessModelJustification: string;
  confidence: number;
};

export type OpportunityEngineResult = {
  goal: ParsedGoal;
  intent: OpportunityIntent;
  reasoning: BusinessReasoningSummary;
  recommendations: OpportunityRecommendation[];
  totalCandidates: number;
};

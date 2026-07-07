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

export type OpportunityRecommendation = {
  title: string;
  niche: string;
  avatar: string;
  problem: string;
  recommendedProduct: string;
  price: number;
  opportunityScore: OpportunityScore;
  estimatedProfit: number;
  investmentScore: number;
  uniquenessScore: number;
  reason: string;
};

export type OpportunityEngineResult = {
  goal: ParsedGoal;
  recommendations: OpportunityRecommendation[];
  totalCandidates: number;
};

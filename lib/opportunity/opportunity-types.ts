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

export type OpportunityConstraints = {
  minimumCapital: number;
  minimumTimeHoursPerDay: number;
  minimumExperience: "iniciante" | "intermediario" | "avancado";
  complexity: number;
  cashGenerationSpeed: number;
};

export type RealityProfile = {
  raw: string;
  availableCapital: number;
  timeHoursPerDay: number;
  experience: "iniciante" | "intermediario" | "avancado";
  financialGoal: number;
  deadline: string | null;
  wantsToAppear: boolean;
  team: "sozinho" | "pequena" | "equipe";
  technicalKnowledge: "nenhum" | "basico" | "intermediario" | "avancado";
  monthlyInvestmentCapacity: number;
  profession: string | null;
  hasAudience: boolean;
  hasSalesExperience: boolean;
};

export type RealityCheckItem = {
  constraint: string;
  message: string;
  severity: "info" | "warning" | "block";
};

export type BusinessPathStep = {
  phase: string;
  action: string;
  modelHint: string;
};

export type EvolutionPlanPhase = {
  label: string;
  focus: string;
  milestone: string;
};

export type PathRecommendationPhase = {
  horizon: string;
  recommendation: string;
  model: string;
};

export type RealityEngineSummary = {
  profile: RealityProfile;
  realityScore: number;
  realityChecks: RealityCheckItem[];
  businessPath: BusinessPathStep[];
  evolutionPlan: EvolutionPlanPhase[];
  pathRecommendation: PathRecommendationPhase[];
  filteredCount: number;
  eliminatedModels: string[];
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
  decisionExplanation: string;
  competitiveAdvantages: string[];
  risks: string[];
  assumptions: string[];
  firstMvp: string;
  firstSalePlan: string;
  estimatedInvestment: number;
  estimatedValidationTime: string;
  constraints: OpportunityConstraints;
  realityPenalty: number;
  realityCompatible: boolean;
};

export type OpportunityComparisonEntry = {
  rank: number;
  title: string;
  businessModel: string;
  verdict: string;
  highlights: string[];
  label: "recomendada" | "alternativa" | "evitar";
};

export type RecommendationSummary = {
  recommendedOption: number;
  recommendedTitle: string;
  narrative: string;
  reasons: string[];
  optionYCondition: string;
  avoidOptionZ: string;
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
  reality: RealityEngineSummary;
  recommendations: OpportunityRecommendation[];
  comparison: OpportunityComparisonEntry[];
  recommendationSummary: RecommendationSummary;
  totalCandidates: number;
};

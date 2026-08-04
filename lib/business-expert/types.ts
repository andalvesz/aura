/**
 * Business Expert B1.X — Production Ready contracts (extends B1.0).
 * Skill layer over Aura Kernel — no parallel engines.
 */

export const BUSINESS_EXPERT_VERSION = "1.1.0" as const;
export const BUSINESS_EXPERT_CAPABILITY_ID = "module.business-expert" as const;
export const BUSINESS_EXPERT_SKILL_ID = "skill.business-expert" as const;
export const BUSINESS_EXPERT_CATEGORY = "Business Intelligence" as const;

/** Expanded knowledge domains for production use. */
export type BusinessKnowledgeDomainId =
  | "mercado"
  | "empreendedorismo"
  | "marketing"
  | "vendas"
  | "growth"
  | "financeiro"
  | "produto"
  | "operacao"
  | "escala"
  | "juridico"
  | "impostos"
  | "validacao"
  | "concorrencia"
  | "posicionamento"
  | "oferta"
  | "preco"
  | "branding"
  | "aquisicao"
  | "retencao"
  | "modelos-de-negocio"
  | "monetizacao";

/** High-level business archetypes (compatible with B1.0 + expansions). */
export type SupportedBusinessType =
  | "produto-digital"
  | "afiliado"
  | "saas"
  | "marketplace"
  | "agencia"
  | "consultoria"
  | "mentoria"
  | "comunidade"
  | "assinatura"
  | "prestacao-de-servico"
  | "loja-fisica"
  | "e-commerce"
  | "negocios-locais"
  | "infoproduto"
  | "curso"
  | "app"
  | "ferramenta-ia"
  | "template"
  | "prompt-pack"
  | "newsletter"
  | "membership"
  | "creator";

export type DigitalBusinessId =
  | "infoprodutos"
  | "afiliados"
  | "comunidades"
  | "assinaturas"
  | "mentorias"
  | "consultorias"
  | "cursos"
  | "apps"
  | "ferramentas-ia"
  | "templates"
  | "prompt-packs"
  | "newsletter"
  | "membership"
  | "marketplace"
  | "saas";

export type LocalBusinessId =
  | "academia"
  | "restaurante"
  | "hamburgueria"
  | "arcade"
  | "bar"
  | "clinica"
  | "escola"
  | "loja"
  | "agencia"
  | "franquia"
  | "salao"
  | "studio"
  | "coworking";

export type BusinessModeId =
  | "afiliado"
  | "produtor"
  | "prestador"
  | "agencia"
  | "startup"
  | "empresa-local"
  | "creator"
  | "freelancer";

export type MarketplaceId =
  | "kiwify"
  | "hotmart"
  | "eduzz"
  | "braip"
  | "herospark"
  | "monetizze"
  | "ticto"
  | "kirvano"
  | "gumroad"
  | "shopify"
  | "woocommerce"
  | "stripe"
  | "mercado-pago";

export type MarketingChannelId =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "linkedin"
  | "threads"
  | "seo"
  | "google-ads"
  | "meta-ads"
  | "tiktok-ads"
  | "email-marketing"
  | "whatsapp";

export type KnowledgePackId =
  | "business-pack"
  | "affiliate-pack"
  | "marketing-pack"
  | "kiwify-pack"
  | "hotmart-pack"
  | "saas-pack"
  | "local-business-pack"
  | "growth-pack";

export type ExperienceLevel =
  | "none"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type CapitalBand =
  | "bootstrap"
  | "low"
  | "medium"
  | "high"
  | "funded"
  | "unknown";

export type AvailabilityBand =
  | "side"
  | "part-time"
  | "full-time"
  | "unknown";

export type TeamSizeBand =
  | "solo"
  | "2-5"
  | "6-20"
  | "20+"
  | "unknown";

export type BusinessObjectiveKind =
  | "abrir-negocio"
  | "empreender"
  | "monetizar"
  | "validar-ideia"
  | "criar-empresa"
  | "crescer"
  | "operar"
  | "outro";

export type BusinessObjectiveStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type BusinessVentureStatus =
  | "idea"
  | "validating"
  | "active"
  | "paused"
  | "closed"
  | "past";

export type BusinessIntentKind =
  | "open_business"
  | "start_entrepreneurship"
  | "make_money"
  | "validate_idea"
  | "create_company"
  | "create_course"
  | "sell_online"
  | "live_from_internet"
  | "affiliate"
  | "create_product"
  | "platform_compare"
  | "price_help"
  | "find_clients"
  | "grow"
  | "scale"
  | "build_offer"
  | "overview"
  | "advise"
  | "plan"
  | "scenario"
  | "unknown";

export type DifficultyLevel = "low" | "medium" | "high" | "very-high";

export type BusinessProfile = {
  userId: string;
  kind: "business_profile";
  version: typeof BUSINESS_EXPERT_VERSION;
  experience: ExperienceLevel;
  capital: CapitalBand;
  objectives: string[];
  interestAreas: BusinessKnowledgeDomainId[];
  skills: string[];
  currentBusinesses: string[];
  pastBusinesses: string[];
  availability: AvailabilityBand;
  team: TeamSizeBand;
  preferences: Record<string, string>;
  preferredBusinessTypes: SupportedBusinessType[];
  activeMode: BusinessModeId | null;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};

export type BusinessObjective = {
  id: string;
  userId: string;
  kind: BusinessObjectiveKind;
  title: string;
  description: string;
  status: BusinessObjectiveStatus;
  relatedDomains: BusinessKnowledgeDomainId[];
  relatedBusinessTypes: SupportedBusinessType[];
  successCriteria: string[];
  createdAt: string;
  updatedAt: string;
};

export type BusinessVenture = {
  id: string;
  userId: string;
  name: string;
  type: SupportedBusinessType;
  status: BusinessVentureStatus;
  summary: string;
  domains: BusinessKnowledgeDomainId[];
  monetizationModel: string | null;
  mode: BusinessModeId | null;
  stageNotes: string[];
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeArticle = {
  id: string;
  domain: BusinessKnowledgeDomainId;
  title: string;
  summary: string;
  bullets: string[];
  relatedBusinessTypes: SupportedBusinessType[];
  source: "builtin" | "pack" | "ingested";
  packId?: KnowledgePackId;
};

export type BusinessTypeCard = {
  id: SupportedBusinessType;
  name: string;
  summary: string;
  typicalMonetization: string[];
  commonRisks: string[];
  validationHints: string[];
  bestFitCapital: CapitalBand[];
  digital?: boolean;
  local?: boolean;
};

export type DomainDefinition = {
  id: BusinessKnowledgeDomainId;
  name: string;
  summary: string;
  keyQuestions: string[];
  guidanceOnly?: boolean;
};

export type MarketplaceRecord = {
  id: MarketplaceId;
  name: string;
  description: string;
  category: string;
  useCases: string[];
  advantages: string[];
  limitations: string[];
  businessTypes: SupportedBusinessType[];
  checkout: boolean;
  recurrence: boolean;
  affiliates: boolean;
  producer: boolean;
  api: boolean;
  documentation: string;
  futureIntegrations: string[];
  /** Static guidance — prefer web research for fees/rankings current as of today. */
  guidanceNote: string;
};

export type MarketingChannelRecord = {
  id: MarketingChannelId;
  name: string;
  description: string;
  category: "organic" | "paid" | "hybrid";
  strengths: string[];
  bestFor: SupportedBusinessType[];
  tips: string[];
};

export type BusinessModeDefinition = {
  id: BusinessModeId;
  name: string;
  summary: string;
  fitWhen: string[];
  primaryDomains: BusinessKnowledgeDomainId[];
  typicalTypes: SupportedBusinessType[];
  firstMoves: string[];
};

export type DigitalBusinessDefinition = {
  id: DigitalBusinessId;
  name: string;
  summary: string;
  monetization: string[];
  validation: string[];
  platforms: MarketplaceId[];
};

export type LocalBusinessDefinition = {
  id: LocalBusinessId;
  name: string;
  summary: string;
  capexHints: string;
  operations: string[];
  marketingLocal: string[];
  risks: string[];
};

export type KnowledgePackDefinition = {
  id: KnowledgePackId;
  name: string;
  summary: string;
  domains: BusinessKnowledgeDomainId[];
  articleIds: string[];
  relatedModes: BusinessModeId[];
  sourcesAllowed: Array<"pdf" | "docx" | "article" | "course" | "link">;
};

export type BusinessContext = {
  kind: "business_context";
  version: typeof BUSINESS_EXPERT_VERSION;
  userId: string;
  profile: BusinessProfile;
  objectives: BusinessObjective[];
  ventures: BusinessVenture[];
  activeDomains: BusinessKnowledgeDomainId[];
  activeBusinessTypes: SupportedBusinessType[];
  activeMode: BusinessModeId | null;
  knowledgeIds: string[];
  gaps: string[];
  limitations: string[];
  generatedAt: string;
};

export type AdvisorRecommendation = {
  id: string;
  title: string;
  rationale: string;
  domain: BusinessKnowledgeDomainId;
  priority: "low" | "medium" | "high";
  nextSteps: string[];
  relatedBusinessTypes: SupportedBusinessType[];
  kind?:
    | "product"
    | "niche"
    | "business"
    | "strategy"
    | "platform"
    | "general";
};

export type AdvisorResult = {
  intent: BusinessIntentKind;
  summary: string;
  recommendations: AdvisorRecommendation[];
  suggestedDomains: BusinessKnowledgeDomainId[];
  suggestedBusinessTypes: SupportedBusinessType[];
  suggestedModes: BusinessModeId[];
  suggestedMarketplaces: MarketplaceId[];
  missingInformation: string[];
  limitations: string[];
  href: string;
  needsWebResearch: boolean;
  webResearchQuery: string | null;
};

export type BusinessPlanStep = {
  title: string;
  description: string;
  order: number;
  domain: BusinessKnowledgeDomainId | null;
  successCriteria: string[];
};

export type BusinessPlanDraft = {
  title: string;
  objective: string;
  summary: string;
  assumptions: string[];
  limitations: string[];
  successCriteria: string[];
  steps: BusinessPlanStep[];
  checklist: string[];
  milestones: Array<{ title: string; criteria: string }>;
  kpis: Array<{ name: string; target: string }>;
  projectOutline: { name: string; description: string };
  missionOutline: { name: string; description: string };
  pipelineSteps: string[];
  sourceKind: "business_expert";
  confidence: number;
  forCorePlanner: true;
};

export type IdeaValidationInput = {
  idea: string;
  audience?: string;
  market?: string;
  capital?: CapitalBand;
  time?: AvailabilityBand;
  experience?: ExperienceLevel;
};

export type IdeaValidationResult = {
  idea: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  opportunities: string[];
  competitionNotes: string[];
  difficulty: DifficultyLevel;
  recommendation: string;
  nextSteps: string[];
  score: number;
  relatedModes: BusinessModeId[];
  relatedTypes: SupportedBusinessType[];
};

export type AffiliateIntake = {
  timeAvailable?: AvailabilityBand;
  capital?: CapitalBand;
  paidTraffic?: boolean;
  organic?: boolean;
  experience?: ExperienceLevel;
  financialGoal?: string;
};

export type AffiliateAssistantResult = {
  missingQuestions: string[];
  complete: boolean;
  recommendedPlatforms: MarketplaceRecord[];
  platformDiffs: string[];
  plan: BusinessPlanDraft | null;
  projectOutline: { name: string; description: string } | null;
  summary: string;
};

export type ProductBuilderIntake = {
  problem?: string;
  audience?: string;
  format?: string;
  ticket?: string;
  deadline?: string;
};

export type ProductBuilderResult = {
  missingQuestions: string[];
  complete: boolean;
  name: string | null;
  promise: string | null;
  offer: string | null;
  modules: string[];
  bonuses: string[];
  structure: string[];
  projectOutline: { name: string; description: string } | null;
  plan: BusinessPlanDraft | null;
  summary: string;
};

export type LocalAdvisorIntake = {
  city?: string;
  capital?: CapitalBand;
  type?: LocalBusinessId;
  goal?: string;
  time?: AvailabilityBand;
};

export type LocalAdvisorResult = {
  missingQuestions: string[];
  complete: boolean;
  estimatedInvestment: string;
  structure: string[];
  operations: string[];
  marketing: string[];
  financial: string[];
  plan: BusinessPlanDraft | null;
  summary: string;
};

export type ComparisonPair =
  | "kiwify_vs_hotmart"
  | "affiliate_vs_own_product"
  | "agency_vs_saas"
  | "store_vs_ecommerce"
  | "custom";

export type BusinessComparisonResult = {
  pair: ComparisonPair;
  label: string;
  optionA: { name: string; pros: string[]; cons: string[] };
  optionB: { name: string; pros: string[]; cons: string[] };
  recommendation: string;
  confidence: number;
  needsFreshWebResearch: boolean;
  researchQuery: string | null;
};

export type BusinessOpportunitySignal = {
  id: string;
  kind:
    | "nova-oportunidade"
    | "novo-mercado"
    | "nova-plataforma"
    | "novo-nicho"
    | "novo-concorrente";
  title: string;
  summary: string;
  confidence: number;
};

export type BusinessRecommendationCard = {
  id: string;
  kind: "product" | "niche" | "business" | "strategy" | "platform";
  title: string;
  summary: string;
  priority: "low" | "medium" | "high";
  nextSteps: string[];
};

export type BusinessScenarioDraft = {
  prompt: string;
  branches: Array<{
    label: string;
    impact: string;
    upside: string;
    downside: string;
    nextStep: string;
  }>;
  forCoreScenario: true;
};

export type WebResearchStatus =
  | "not_needed"
  | "provider_missing"
  | "ready"
  | "stale_static_only";

export type WebResearchRequest = {
  query: string;
  reason: string;
  status: WebResearchStatus;
  results: Array<{ title: string; snippet: string; url?: string; asOf?: string }>;
  disclaimer: string;
};

export type KnowledgeIngestRequest = {
  userId: string;
  title: string;
  kind: "pdf" | "docx" | "article" | "course" | "link";
  sourceRef: string;
  packId?: KnowledgePackId;
  notes?: string;
};

export type KnowledgeIngestRecord = {
  id: string;
  userId: string;
  title: string;
  kind: KnowledgeIngestRequest["kind"];
  sourceRef: string;
  packId: KnowledgePackId | null;
  notes: string;
  status: "queued" | "ready_for_hub";
  createdAt: string;
};

export type BusinessExpertOverview = {
  version: typeof BUSINESS_EXPERT_VERSION;
  capabilityId: typeof BUSINESS_EXPERT_CAPABILITY_ID;
  skillId: typeof BUSINESS_EXPERT_SKILL_ID;
  category: typeof BUSINESS_EXPERT_CATEGORY;
  profileCompleteness: number;
  domainCount: number;
  businessTypeCount: number;
  marketplaceCount: number;
  modeCount: number;
  objectiveCount: number;
  ventureCount: number;
  knowledgeCount: number;
  packCount: number;
  gaps: string[];
  nextActions: string[];
};

export type BusinessExpertRunInput = {
  userId: string;
  message?: string;
  intent?: BusinessIntentKind;
  now?: string;
  affiliateIntake?: AffiliateIntake;
  productIntake?: ProductBuilderIntake;
  localIntake?: LocalAdvisorIntake;
  ideaInput?: IdeaValidationInput;
};

export type BusinessExpertRunResult = {
  overview: BusinessExpertOverview;
  context: BusinessContext;
  advisor: AdvisorResult;
  planDraft: BusinessPlanDraft | null;
  ideaValidation: IdeaValidationResult | null;
  affiliate: AffiliateAssistantResult | null;
  product: ProductBuilderResult | null;
  local: LocalAdvisorResult | null;
  comparison: BusinessComparisonResult | null;
  opportunities: BusinessOpportunitySignal[];
  recommendations: BusinessRecommendationCard[];
  scenario: BusinessScenarioDraft | null;
  webResearch: WebResearchRequest | null;
  learningSignal: {
    sourceLayer: "business-expert";
    event: string;
    summary: string;
  } | null;
};

export type BusinessExpertState = {
  profiles: BusinessProfile[];
  objectives: BusinessObjective[];
  ventures: BusinessVenture[];
  ideas: Array<IdeaValidationResult & { id: string; userId: string; createdAt: string }>;
  ingests: KnowledgeIngestRecord[];
};

export type ValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

export type HomeBusinessWidgets = {
  opportunities: BusinessOpportunitySignal[];
  businesses: BusinessVenture[];
  markets: string[];
  ideas: Array<{ id: string; idea: string; score: number }>;
  projects: Array<{ name: string; description: string }>;
};

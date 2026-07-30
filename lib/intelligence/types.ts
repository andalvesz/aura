/**
 * Aura Intelligence Engine V1 — structured types only.
 * No OpenAI. No database. Output is never free-form chat text.
 */

export type IntelligencePriorityLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type IntelligenceModule =
  | "financeiro"
  | "calendario"
  | "habitos"
  | "saude"
  | "objetivos"
  | "viagens"
  | "idiomas"
  | "expert_brain"
  | "workspace"
  | "sistema";

export type RuleStatus = "PASS" | "WARNING" | "FAIL";

export type IntelligencePriority = {
  id: string;
  level: IntelligencePriorityLevel;
  module: IntelligenceModule;
  title: string;
  description: string;
  target?: string | null;
  sourceRule: string;
};

export type IntelligenceAlert = {
  id: string;
  type: string;
  severity: IntelligencePriorityLevel;
  module: IntelligenceModule;
  title: string;
  description: string;
  action?: string | null;
  target?: string | null;
  sourceRule: string;
};

export type IntelligenceRecommendation = {
  id: string;
  module: IntelligenceModule;
  title: string;
  description: string;
  action?: string | null;
  target?: string | null;
  reason: string;
};

export type IntelligenceInsight = {
  id: string;
  module: IntelligenceModule;
  kind: string;
  title: string;
  description: string;
  value?: string | number | null;
};

export type IntelligenceScoreDimensions = {
  financeiro: number;
  saude: number;
  produtividade: number;
  aprendizado: number;
  organizacao: number;
  consistencia: number;
};

export type IntelligenceScore = IntelligenceScoreDimensions & {
  overall: number;
};

export type RuleResult = {
  ruleId: string;
  module: IntelligenceModule;
  status: RuleStatus;
  title: string;
  description: string;
  /** Suggested priority when status is WARNING or FAIL */
  severity: IntelligencePriorityLevel;
  target?: string | null;
  action?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

export type IntelligenceRule = {
  id: string;
  module: IntelligenceModule;
  evaluate: (input: AuraIntelligenceInput) => RuleResult | RuleResult[] | null;
};

/** Slim personal DTO — never raw DB rows */
export type PersonalIntelligenceDTO = {
  agenda: {
    today: { id: string; titulo: string; start?: string; end?: string | null }[];
    overdue: { id: string; titulo: string; data: string }[];
    next7Days: { id: string; titulo: string; data: string }[];
    /** Timed events for conflict detection */
    timedEvents: {
      id: string;
      titulo: string;
      start: string;
      end: string | null;
    }[];
  };
  habits: {
    pending: { id: string; titulo: string; data: string }[];
    completedToday: { id: string; titulo: string }[];
    streakDays: number;
    dailyProgressPct: number;
  };
  health: {
    workoutToday: boolean;
    workoutName: string | null;
    mealsToday: number;
    /** Days since last workout; null if unknown / never */
    daysSinceLastWorkout: number | null;
  };
  finance: {
    saldoAtual: number | null;
    hasSaldo: boolean;
    gastoHoje: number;
    gastoMes: number;
    receitaMes: number;
    orcamentoPct: number | null;
    orcamentoRestante: number | null;
    budgetAlert: boolean;
    /** Optional top category for insights */
    topCategory?: { key: string; total: number } | null;
  };
  goals: {
    activeCount: number;
    items: {
      id: string;
      titulo: string;
      prazo: string;
      remainingDays: number;
      atual: number;
      meta: number;
      behind?: boolean;
    }[];
  };
  travel: {
    trip: {
      id: string;
      titulo: string;
      daysRemaining: number;
      checklistPct: number;
      nextChecklist: string | null;
    } | null;
  };
  language: {
    configured: boolean;
    practicedToday: boolean;
    streak: number;
    modoLabel: string | null;
  };
  expertBrain: {
    documents: number;
    pending: number;
    processing: number;
    errors: number;
    lastActivityAt: string | null;
  };
};

export type WorkspaceIntelligenceDTO = {
  workspaceId: string;
  workspaceName: string;
  role: string;
  openPropostas: number;
  followUpsPending: number;
  estoqueAlerts: number;
  pendingInvites: number;
  upcomingEvents: number;
  alerts: string[];
};

export type AuraIntelligenceInput = {
  userId: string;
  context: "personal" | "workspace";
  asOf: string;
  personal?: PersonalIntelligenceDTO | null;
  workspace?: WorkspaceIntelligenceDTO | null;
};

export type AuraIntelligenceResult = {
  priorities: IntelligencePriority[];
  alerts: IntelligenceAlert[];
  recommendations: IntelligenceRecommendation[];
  insights: IntelligenceInsight[];
  score: IntelligenceScore;
  ruleResults: RuleResult[];
  meta: {
    context: "personal" | "workspace";
    asOf: string;
    generatedAt: string;
    executionMs: number;
    rulesRun: number;
    cacheHit: boolean;
  };
};

/**
 * Future AI layer — NOT implemented in V1.
 * Receives structured engine output and would produce natural language.
 */
export type ExplainWithAIInput = {
  priorities: IntelligencePriority[];
  alerts: IntelligenceAlert[];
  insights: IntelligenceInsight[];
  recommendations: IntelligenceRecommendation[];
  score: IntelligenceScore;
};

export type ExplainWithAI = (
  input: ExplainWithAIInput
) => Promise<{ explanation: string }>;

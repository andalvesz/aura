import type { ExpertContext } from "@/utils/expert-brain";

export const INFLUENCE_TARGETS = {
  frameworks: 3,
  decisionRules: 3,
  successPatterns: 2,
} as const;

export const INFLUENCE_WARNING_THRESHOLD = 70;

export const INFLUENCE_WEIGHTS = {
  frameworks: 0.35,
  decisionRules: 0.35,
  successPatterns: 0.3,
} as const;

export type ExpertInfluenceAudit = {
  generationId: string;
  consulted: {
    frameworkIds: string[];
    decisionRuleIds: string[];
    successPatternIds: string[];
    failurePatternIds: string[];
  };
  applied: {
    frameworkIds: string[];
    decisionRuleIds: string[];
    successPatternIds: string[];
    failurePatternIds: string[];
  };
  influenceScore: number;
  belowTarget: boolean;
  warning: string | null;
};

export function extractConsultedIds(context: ExpertContext) {
  return {
    frameworkIds: context.frameworks.map((f) => f.id),
    decisionRuleIds: context.decisionRules.map((r) => r.id),
    successPatternIds: context.successPatterns.map((p) => p.id),
    failurePatternIds: context.failurePatterns.map((p) => p.id),
  };
}

export function extractAppliedIds(context: ExpertContext, promptApplied: boolean) {
  if (!promptApplied) {
    return {
      frameworkIds: [] as string[],
      decisionRuleIds: [] as string[],
      successPatternIds: [] as string[],
      failurePatternIds: [] as string[],
    };
  }
  return extractConsultedIds(context);
}

export function computeInfluenceScore(params: {
  appliedFrameworkCount: number;
  appliedDecisionRuleCount: number;
  appliedSuccessPatternCount: number;
  promptApplied: boolean;
}): number {
  const fw =
    Math.min(params.appliedFrameworkCount / INFLUENCE_TARGETS.frameworks, 1) *
    INFLUENCE_WEIGHTS.frameworks *
    100;
  const dr =
    Math.min(params.appliedDecisionRuleCount / INFLUENCE_TARGETS.decisionRules, 1) *
    INFLUENCE_WEIGHTS.decisionRules *
    100;
  const sp =
    Math.min(params.appliedSuccessPatternCount / INFLUENCE_TARGETS.successPatterns, 1) *
    INFLUENCE_WEIGHTS.successPatterns *
    100;

  let score = fw + dr + sp;
  if (!params.promptApplied) score = Math.min(score, INFLUENCE_WARNING_THRESHOLD - 1);

  return Math.round(score * 100) / 100;
}

export function buildInfluenceWarning(applied: {
  frameworkIds: string[];
  decisionRuleIds: string[];
  successPatternIds: string[];
}, score: number): string | null {
  const gaps: string[] = [];
  if (applied.frameworkIds.length < INFLUENCE_TARGETS.frameworks) {
    gaps.push(`${INFLUENCE_TARGETS.frameworks - applied.frameworkIds.length} framework(s)`);
  }
  if (applied.decisionRuleIds.length < INFLUENCE_TARGETS.decisionRules) {
    gaps.push(`${INFLUENCE_TARGETS.decisionRules - applied.decisionRuleIds.length} decision rule(s)`);
  }
  if (applied.successPatternIds.length < INFLUENCE_TARGETS.successPatterns) {
    gaps.push(`${INFLUENCE_TARGETS.successPatterns - applied.successPatternIds.length} success pattern(s)`);
  }

  if (score >= INFLUENCE_WARNING_THRESHOLD && gaps.length === 0) return null;

  const gapText = gaps.length > 0 ? ` Faltam: ${gaps.join(", ")}.` : "";
  return `Influence Score ${score.toFixed(0)} < ${INFLUENCE_WARNING_THRESHOLD}.${gapText}`;
}

export function buildExpertInfluenceAudit(params: {
  context: ExpertContext;
  promptApplied: boolean;
  generationId?: string;
}): ExpertInfluenceAudit {
  const generationId = params.generationId ?? crypto.randomUUID();
  const consulted = extractConsultedIds(params.context);
  const applied = extractAppliedIds(params.context, params.promptApplied);

  const influenceScore = computeInfluenceScore({
    appliedFrameworkCount: applied.frameworkIds.length,
    appliedDecisionRuleCount: applied.decisionRuleIds.length,
    appliedSuccessPatternCount: applied.successPatternIds.length,
    promptApplied: params.promptApplied,
  });

  const belowTarget =
    applied.frameworkIds.length < INFLUENCE_TARGETS.frameworks ||
    applied.decisionRuleIds.length < INFLUENCE_TARGETS.decisionRules ||
    applied.successPatternIds.length < INFLUENCE_TARGETS.successPatterns ||
    influenceScore < INFLUENCE_WARNING_THRESHOLD;

  const warning = belowTarget ? buildInfluenceWarning(applied, influenceScore) : null;

  return {
    generationId,
    consulted,
    applied,
    influenceScore,
    belowTarget,
    warning,
  };
}

export type ExpertInfluenceDashboard = {
  averageScore: number;
  totalGenerations: number;
  belowTargetCount: number;
  topFrameworks: Array<{ id: string; name: string; count: number }>;
  topDecisionRules: Array<{ id: string; title: string; count: number }>;
  topSuccessPatterns: Array<{ id: string; title: string; count: number }>;
  topModules: Array<{ module: string; count: number; averageScore: number }>;
  recentLogs: Array<{
    id: string;
    moduleName: string;
    influenceScore: number;
    belowTarget: boolean;
    createdAt: string;
  }>;
};

export const INFLUENCE_MODULE_LABELS: Record<string, string> = {
  "product-factory": "Product Factory",
  copylab: "CopyLab",
  "offer-engine": "Offer Engine",
  "funnel-engine": "Funnel Engine",
  "funnel-pages": "Funnel Pages",
  "landing-factory": "Landing Factory",
  "creative-director": "Creative Director",
  "ads-commander": "Ads Commander",
  "decision-engine": "Decision Engine",
};

import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";

export type ValidationResult = {
  approved: boolean;
  validationScore: number;
  marketConfidence: number;
  executionDifficulty: number;
  competitionRisk: number;
  marketTiming: number;
  monetizationPotential: number;
  recommendation: string;
  reasons: string[];
};

export type ValidationInsights = {
  strengths: string[];
  weaknesses: string[];
  risks: string[];
};

export type ValidationInput = OpportunityRecommendation;

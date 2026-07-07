import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ValidationResult } from "@/lib/validation/validation-types";

export type ProductStrategyType =
  | "curso_online"
  | "kit_premium"
  | "comunidade"
  | "mentoria"
  | "desafio";

export type ProductStrategyScores = {
  revenue: number;
  execution: number;
  scalability: number;
  speed: number;
  investment: number;
  total: number;
};

export type ProductStrategyRecommendation = {
  id: string;
  label: string;
  strategyType: ProductStrategyType;
  strategyName: string;
  ticket: number;
  ticketLabel: string;
  estimatedRevenue: number;
  estimatedCost: number;
  estimatedLaunchTime: number;
  estimatedMargin: number;
  estimatedROI: number;
  ltvMonths?: number;
  scalabilityLabel: string;
  scores: ProductStrategyScores;
  reason: string;
};

export type ProductStrategistInput = {
  validation: ValidationResult;
  opportunity: OpportunityRecommendation;
};

export type ProductStrategistResult = {
  strategies: ProductStrategyRecommendation[];
  recommendation: ProductStrategyRecommendation;
  explanation: string;
};

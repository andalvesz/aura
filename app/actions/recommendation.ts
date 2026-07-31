"use server";

import { revalidatePath } from "next/cache";
import {
  explainRecommendationItem,
  generateRecommendations,
  getHomeRecommendationWidget,
  getRecommendationItem,
  listRecommendationAudit,
  listRecommendationItems,
  searchRecommendationItems,
  submitRecommendationFeedback,
} from "@/lib/supabase/services/recommendation.service";
import type {
  ImpactLevel,
  RecommendationFeedbackKind,
  RecommendationStatus,
  RecommendationType,
  UrgencyLevel,
} from "@/lib/recommendation/types/types";

function revalidateRecommendations(recommendationId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/recommendations");
  if (recommendationId) {
    revalidatePath(`/dashboard/recommendations/${recommendationId}`);
  }
}

export async function generateRecommendationsAction() {
  const res = await generateRecommendations();
  revalidateRecommendations();
  return res;
}

export async function listRecommendationsAction(opts?: {
  status?: RecommendationStatus | RecommendationStatus[];
  recommendationType?: RecommendationType;
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  confidenceMin?: number;
  projectId?: string;
  businessId?: string;
  limit?: number;
  offset?: number;
  ranked?: boolean;
}) {
  return listRecommendationItems(opts);
}

export async function getRecommendationAction(recommendationId: string) {
  return getRecommendationItem(recommendationId);
}

export async function submitRecommendationFeedbackAction(input: {
  recommendationId: string;
  kind: RecommendationFeedbackKind;
  note?: string | null;
}) {
  const res = await submitRecommendationFeedback(input);
  revalidateRecommendations(input.recommendationId);
  return res;
}

export async function explainRecommendationAction(recommendationId: string) {
  return explainRecommendationItem(recommendationId);
}

export async function searchRecommendationsAction(
  query: string,
  limit?: number
) {
  return searchRecommendationItems(query, limit);
}

export async function getHomeRecommendationWidgetAction() {
  return getHomeRecommendationWidget();
}

export async function listRecommendationAuditAction(limit?: number) {
  return listRecommendationAudit(limit);
}

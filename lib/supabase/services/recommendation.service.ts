/**
 * Recommendation service facade (Sprint 7.3) — re-export under supabase/services.
 * executionInfluence: "none"
 */

export {
  generateRecommendations,
  listRecommendationItems,
  getRecommendationItem,
  submitRecommendationFeedback,
  explainRecommendationItem,
  searchRecommendationItems,
  getHomeRecommendationWidget,
  listRecommendationAudit,
} from "@/lib/recommendation/services/recommendation.service";

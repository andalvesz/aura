/**
 * Decision Support service facade (Sprint 7.0) — re-export under supabase/services.
 * executionInfluence: "none"
 */

export {
  generateDecisionSupport,
  listDecisionCards,
  getDecisionCard,
  submitDecisionFeedback,
  explainDecisionCard,
  searchDecisionCards,
  getHomeDecisionWidget,
  listDecisionAudit,
} from "@/lib/decision-support/services/decision-support.service";

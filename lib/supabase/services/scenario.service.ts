/**
 * Scenario service facade — supabase/services re-export.
 * executionInfluence: "none"
 */

export {
  simulateScenarios,
  listScenarioCards,
  getScenarioCard,
  submitScenarioFeedback,
  compareScenarioCards,
  explainScenarioCard,
  searchScenarioCards,
  getHomeScenarioWidget,
  listScenarioComparisons,
} from "@/lib/scenario/services/scenario.service";

/**
 * Automation service facade — re-export under supabase/services.
 */

export {
  proposeAutomation,
  prepareAutomation,
  confirmAutomation,
  executeAutomation,
  scheduleAutomation,
  cancelAutomation,
  retryAutomation,
  undoAutomation,
  listAutomations,
  getAutomation,
  explainAutomation,
  processEligibleAutomations,
  getHomeAutomationWidget,
  searchAutomationItems,
  listAutomationAudit,
  listAutomationNotifications,
  updateAutomationSettings,
  revokePendingConfirmations,
  proposeFromPlanStep,
} from "@/lib/automation/services/automation.service";

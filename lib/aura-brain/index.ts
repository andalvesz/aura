/**
 * Aura Brain Core — public surface.
 */

export { runAuraBrain, getAuraBrainSettings } from "@/lib/aura-brain/core";
export {
  getAuraBrainSettings as readAuraBrainSettings,
  setAuraBrainSettings,
  buildRuntimeContext,
} from "@/lib/aura-brain/context";
export { presentAuraBrainActivity } from "@/lib/aura-brain/communication/presenter";
export {
  executeAuraBrainAction,
} from "@/lib/aura-brain/actions/executor";
export {
  ensureBuiltinActions,
  listActions,
  getAction,
} from "@/lib/aura-brain/actions/registry";
export { runAuraBrainPlanner } from "@/lib/aura-brain/planner/planner";
export {
  runAuraBrainAutomations,
  resetAutomationState,
  markNotified,
} from "@/lib/aura-brain/automations/engine";
export { recordFeedback, listFeedback } from "@/lib/aura-brain/learning/feedback";
export { listRecentAudits, sanitizeAuditInput } from "@/lib/aura-brain/audit";
export type * from "@/lib/aura-brain/types";

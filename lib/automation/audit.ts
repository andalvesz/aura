import type {
  AutomationAuditEntry,
  AutomationState,
  AutomationViewer,
} from "@/lib/automation/types/types";
import { getAutomationPure } from "@/lib/automation/engine";

export function listAutomationAuditPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId?: string,
  limit = 50
): AutomationAuditEntry[] {
  let items = state.audits.filter((a) => a.userId === viewer.userId);
  if (automationId) {
    const auto = getAutomationPure(state, viewer, automationId);
    if (!auto) return [];
    items = items.filter((a) => a.automationId === automationId);
  }
  return items.slice(0, limit);
}

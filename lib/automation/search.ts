import type {
  AutomationState,
  AutomationViewer,
} from "@/lib/automation/types/types";
import { listAutomationsPure } from "@/lib/automation/engine";

export function searchAutomationsPure(
  state: AutomationState,
  viewer: AutomationViewer,
  query: string,
  limit = 20
): Array<{ id: string; title: string; status: string; href: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listAutomationsPure(state, viewer, { limit: 200 })
    .filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.actionId.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    )
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      href: `/dashboard/automations/${a.id}`,
    }));
}

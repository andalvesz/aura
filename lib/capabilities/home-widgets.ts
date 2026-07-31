/**
 * Aura Home widgets filtered by active capabilities.
 */

import { isCapabilityEffectivelyEnabled } from "@/lib/capabilities/resolver";
import type { PlatformState, ResolveContext } from "@/lib/capabilities/types";
import type { WidgetPriority } from "@/lib/orchestrator/types";

const WIDGET_CAPABILITY: Record<string, string> = {
  projects: "module.projects",
  knowledge: "module.knowledge",
  learning: "module.learning",
  automations: "module.automations",
  agents: "module.agents",
  financeiro: "module.financeiro",
  saude: "module.saude",
  missions: "module.missions",
  business: "module.business",
  recommendations: "module.recommendations",
  alvesz: "workspace.alvesz",
  skills: "module.platform-skills",
};

/** Core widgets always kept. */
const CORE_WIDGETS = new Set([
  "home",
  "discovery",
  "timeline",
  "quick-actions",
  "notifications",
  "memory",
  "plans",
]);

export function filterHomeWidgetsByCapabilities(
  widgets: WidgetPriority[],
  state: PlatformState,
  ctx: ResolveContext
): WidgetPriority[] {
  return widgets.filter((w) => {
    const id = w.id;
    if (CORE_WIDGETS.has(id)) return true;
    const cap = WIDGET_CAPABILITY[id];
    if (!cap) return true;
    return isCapabilityEffectivelyEnabled(state, cap, ctx);
  });
}

/** Test helper — filter by string ids. */
export function filterHomeWidgetIdsByCapabilities(
  widgetIds: string[],
  state: PlatformState,
  ctx: ResolveContext
): string[] {
  return widgetIds.filter((id) => {
    if (CORE_WIDGETS.has(id)) return true;
    const cap = WIDGET_CAPABILITY[id];
    if (!cap) return true;
    return isCapabilityEffectivelyEnabled(state, cap, ctx);
  });
}

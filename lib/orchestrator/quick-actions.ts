/**
 * Quick actions panel model for Aura Home.
 */

import type { QuickAction } from "@/lib/orchestrator/types";

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa-memory",
    label: "Registrar memória",
    href: "/dashboard/settings/memory",
    kind: "create_memory",
  },
  {
    id: "qa-project",
    label: "Abrir projeto",
    href: "/dashboard/projects",
    kind: "open_project",
  },
  {
    id: "qa-plan",
    label: "Criar plano",
    href: "/dashboard/plans",
    kind: "execute_plan",
  },
  {
    id: "qa-agent",
    label: "Abrir agente",
    href: "/dashboard/agents",
    kind: "open_agent",
  },
  {
    id: "qa-discovery",
    label: "Abrir discovery",
    href: "/dashboard/discovery",
    kind: "open_discovery",
  },
  {
    id: "qa-capture",
    label: "Smart Capture",
    href: "/dashboard/inbox",
    kind: "custom",
  },
];

export function buildQuickActions(
  extras: QuickAction[] = []
): QuickAction[] {
  const seen = new Set<string>();
  const out: QuickAction[] = [];
  for (const a of [...DEFAULT_QUICK_ACTIONS, ...extras]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

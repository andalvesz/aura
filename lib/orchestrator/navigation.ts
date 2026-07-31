/**
 * Cross-navigation helpers between Aura modules.
 */

import type { CrossNavLink, OrchestratorModuleId } from "@/lib/orchestrator/types";

const HREF: Record<OrchestratorModuleId, string> = {
  identity: "/dashboard/settings/identity",
  memory: "/dashboard/settings/memory",
  world: "/dashboard/settings/world-model",
  knowledge: "/dashboard/knowledge",
  cognitive: "/dashboard/settings/insights",
  discovery: "/dashboard/discovery",
  decision: "/dashboard/decisions",
  scenario: "/dashboard/scenarios",
  prioritization: "/dashboard/priorities",
  recommendation: "/dashboard/recommendations",
  planner: "/dashboard/plans",
  automation: "/dashboard/automations",
  "agent-runtime": "/dashboard/agents",
  projects: "/dashboard/projects",
  missions: "/dashboard/missions",
  business: "/dashboard/business",
};

const LABEL: Record<OrchestratorModuleId, string> = {
  identity: "Identity",
  memory: "Memória",
  world: "World Model",
  knowledge: "Knowledge",
  cognitive: "Insights",
  discovery: "Discovery",
  decision: "Decisões",
  scenario: "Cenários",
  prioritization: "Prioridades",
  recommendation: "Recomendações",
  planner: "Planos",
  automation: "Automações",
  "agent-runtime": "Agentes",
  projects: "Projetos",
  missions: "Missões",
  business: "Business",
};

/** Canonical cross-links from a module (always available). */
export function crossNavFrom(moduleId: OrchestratorModuleId): CrossNavLink[] {
  const neighbors: OrchestratorModuleId[] = (() => {
    switch (moduleId) {
      case "projects":
        return ["missions", "planner", "recommendation", "knowledge", "discovery"];
      case "planner":
        return ["recommendation", "projects", "automation", "agent-runtime", "decision"];
      case "recommendation":
        return ["prioritization", "planner", "discovery", "decision", "scenario"];
      case "discovery":
        return ["memory", "knowledge", "recommendation", "projects"];
      case "automation":
        return ["planner", "agent-runtime", "recommendation"];
      case "agent-runtime":
        return ["planner", "automation", "projects"];
      case "decision":
        return ["scenario", "recommendation", "planner", "knowledge"];
      default:
        return ["discovery", "knowledge", "projects", "planner"];
    }
  })();

  return neighbors.map((to) => ({
    fromModule: moduleId,
    toModule: to,
    label: LABEL[to],
    href: HREF[to],
  }));
}

export function moduleHref(moduleId: OrchestratorModuleId): string {
  return HREF[moduleId];
}

export function moduleLabel(moduleId: OrchestratorModuleId): string {
  return LABEL[moduleId];
}

export function allModuleHrefs(): Array<{ id: OrchestratorModuleId; href: string; label: string }> {
  return (Object.keys(HREF) as OrchestratorModuleId[]).map((id) => ({
    id,
    href: HREF[id],
    label: LABEL[id],
  }));
}

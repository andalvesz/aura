/**
 * Dynamic dashboard — reorders Aura Home widgets by context signals.
 * Never hides modules; only changes visual priority.
 */

import type {
  AuraHomeWidgetId,
  GlobalContext,
  WidgetPriority,
} from "@/lib/orchestrator/types";

const BASE_ORDER: AuraHomeWidgetId[] = [
  "today",
  "quick-actions",
  "alerts",
  "next-actions",
  "priorities",
  "recommendations",
  "plans",
  "projects",
  "missions",
  "agents",
  "automations",
  "discoveries",
  "knowledge",
  "timeline",
];

const BASE_SCORE: Record<AuraHomeWidgetId, number> = {
  today: 100,
  "quick-actions": 95,
  alerts: 90,
  "next-actions": 88,
  priorities: 80,
  recommendations: 78,
  plans: 75,
  projects: 70,
  missions: 68,
  agents: 65,
  automations: 62,
  discoveries: 60,
  knowledge: 55,
  timeline: 50,
};

export function prioritizeHomeWidgets(ctx: GlobalContext): WidgetPriority[] {
  const boost: Partial<Record<AuraHomeWidgetId, { delta: number; reason: string }>> =
    {};

  const bump = (id: AuraHomeWidgetId, delta: number, reason: string) => {
    const prev = boost[id];
    boost[id] = {
      delta: (prev?.delta ?? 0) + delta,
      reason: prev ? `${prev.reason}; ${reason}` : reason,
    };
  };

  if (ctx.slice.risks.length) bump("alerts", 25, "riscos ativos");
  if (ctx.slice.nextActions.length) bump("next-actions", 20, "ações pendentes");
  if (ctx.slice.priorities.length) bump("priorities", 15, "prioridades da semana");
  if (ctx.slice.recommendations.length)
    bump("recommendations", 12, "recomendações prontas");
  if (ctx.slice.activePlan) bump("plans", 18, "plano ativo na sessão");
  if (ctx.slice.activeProject) bump("projects", 18, "projeto ativo na sessão");
  if (ctx.slice.activeMission) bump("missions", 14, "missão ativa");
  if (ctx.slice.activeAgents.length) bump("agents", 16, "agentes em execução");
  if (ctx.slice.automations.length) bump("automations", 10, "automações");
  if (ctx.slice.opportunities.length)
    bump("discoveries", 14, "oportunidades / discovery");
  if (ctx.slice.discoveries.length) bump("discoveries", 8, "descobertas recentes");
  if (ctx.dataCompleteness.gaps.includes("no_active_project"))
    bump("projects", 5, "sugerir escolher projeto");

  return BASE_ORDER.map((id) => {
    const b = boost[id];
    return {
      id,
      score: BASE_SCORE[id] + (b?.delta ?? 0),
      reason: b?.reason ?? "ordem base",
      visible: true as const,
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Aura Brain Planner — selects and orders actions; never executes.
 */

import { uniqueByKey } from "@/lib/aura-brain/planner/deduplication";
import { proposalsFromPriorities } from "@/lib/aura-brain/planner/rules";
import type { PlannerInput, PlannerOutput } from "@/lib/aura-brain/planner/types";
import type { AuraBrainPlan, ProposedAction } from "@/lib/aura-brain/types";
import type { IntelligencePriority } from "@/lib/intelligence/types";

export function runAuraBrainPlanner(input: PlannerInput): PlannerOutput {
  const started = Date.now();
  const pending = new Set(input.pendingDedupeKeys ?? []);
  const priorities = input.intelligence.priorities as IntelligencePriority[];

  let proposed = proposalsFromPriorities(priorities, pending);

  // Mission Engine → Planner: only LOW-risk / autoExecutable mission actions
  for (const ma of input.missionActions ?? []) {
    if (!ma.autoExecutable) continue;
    const dedupeKey = `mission:${ma.missionId}:${ma.actionId}`;
    if (pending.has(dedupeKey)) continue;
    pending.add(dedupeKey);
    const prop: ProposedAction = {
      id: `prop-${dedupeKey}`,
      actionId: ma.actionId,
      planId: null,
      title: ma.title,
      reason: ma.reason,
      riskLevel: ma.riskLevel === "LOW" ? "LOW" : "MEDIUM",
      autonomyRequired: ma.autoExecutable ? "AUTO_SAFE" : "CONFIRM",
      input: ma.input,
      status: "proposed",
      dedupeKey,
    };
    // Never promote HIGH/CRITICAL mission actions to auto path
    if (ma.riskLevel === "HIGH" || ma.riskLevel === "CRITICAL") {
      prop.autonomyRequired = "CONFIRM";
      prop.riskLevel = ma.riskLevel;
    }
    proposed.push(prop);
  }

  proposed = uniqueByKey(proposed, (p) => p.dedupeKey);

  // Prefer CRITICAL notification proposals first
  proposed.sort((a, b) => {
    const rank = (x: typeof a) =>
      x.actionId === "create_notification" ? 0 : x.riskLevel === "HIGH" ? 2 : 1;
    return rank(a) - rank(b);
  });

  const plans: AuraBrainPlan[] = [];
  const critical = priorities.filter((p) => p.level === "CRITICAL");
  if (critical.length > 0) {
    const notifProps = proposed.filter((p) => p.actionId === "create_notification");
    const planId = `plan-critical-${input.userId.slice(0, 8)}-${Date.now()}`;
    const steps = notifProps.slice(0, 5).map((p, i) => {
      p.planId = planId;
      return {
        id: `step-${i}`,
        order: i,
        actionId: p.actionId,
        title: p.title,
        status: "PROPOSED" as const,
        input: p.input,
      };
    });
    plans.push({
      id: planId,
      title: "Alertar prioridades críticas",
      objective: "Notificar o usuário sobre prioridades CRITICAL novas",
      source: "intelligence.priorities",
      priority: "CRITICAL",
      status: "PROPOSED",
      context: input.context,
      steps,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.9,
      requiresConfirmation: false,
    });
  }

  // Soft plan from top recommendation when no critical
  if (plans.length === 0 && input.intelligence.recommendations.length > 0) {
    const rec = input.intelligence.recommendations[0] as {
      id: string;
      title: string;
      description: string;
    };
    plans.push({
      id: `plan-rec-${rec.id}`,
      title: rec.title,
      objective: rec.description,
      source: "intelligence.recommendations",
      priority: "MEDIUM",
      status: "DRAFT",
      context: input.context,
      steps: [],
      createdAt: new Date().toISOString(),
      expiresAt: null,
      confidence: 0.6,
      requiresConfirmation: true,
    });
  }

  // Mission plan from first mission action
  const missionProp = proposed.find((p) => p.dedupeKey.startsWith("mission:"));
  if (missionProp && plans.length < 2) {
    const planId = `plan-mission-${input.userId.slice(0, 8)}`;
    missionProp.planId = planId;
    plans.push({
      id: planId,
      title: missionProp.title,
      objective: missionProp.reason,
      source: "mission_engine",
      priority: missionProp.riskLevel === "LOW" ? "MEDIUM" : "HIGH",
      status: "PROPOSED",
      context: input.context,
      steps: [
        {
          id: "step-0",
          order: 0,
          actionId: missionProp.actionId,
          title: missionProp.title,
          status: "PROPOSED",
          input: missionProp.input,
        },
      ],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.7,
      requiresConfirmation:
        !missionProp.autonomyRequired ||
        missionProp.autonomyRequired !== "AUTO_SAFE",
    });
  }

  return {
    plans,
    proposedActions: proposed,
    executionMs: Date.now() - started,
  };
}

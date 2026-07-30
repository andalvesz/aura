/**
 * Mission Engine V1 — pure orchestrator.
 * App code should prefer getMissionEngine() from the service.
 */

import { runMissionPlanner } from "@/lib/missions/mission-planner";
import { runMissionProgressPass } from "@/lib/missions/mission-progress";
import {
  buildSuggestedActions,
  filterSafeAutomationProposals,
} from "@/lib/missions/mission-rules";
import type {
  MissionEngineInput,
  MissionEngineResult,
  MissionSuggestedAction,
} from "@/lib/missions/mission-types";

export function runMissionEngine(input: MissionEngineInput): MissionEngineResult {
  const started = Date.now();
  const asOf = input.asOf ?? new Date().toISOString();

  const planned = runMissionPlanner({
    userId: input.userId,
    existing: input.missions ?? [],
    create: input.create,
    asOf,
  });

  const progressed = runMissionProgressPass(
    planned.missions,
    new Date(asOf)
  );

  // Boost priority when intelligence signals CRITICAL/HIGH related themes
  const boosted = progressed.missions.map((m) => {
    if (!input.intelligence?.priorities?.length) return m;
    const hit = input.intelligence.priorities.some((p) => {
      if (p.level !== "CRITICAL" && p.level !== "HIGH") return false;
      const hay = `${m.title} ${m.type} ${m.modules.join(" ")}`.toLowerCase();
      return (
        hay.includes(p.module.toLowerCase()) ||
        m.modules.some((mod) => mod.includes(p.module.replace(/_/g, "")))
      );
    });
    if (!hit) return m;
    return {
      ...m,
      priority: Math.min(100, m.priority + 10),
      score: {
        ...m.score,
        priority: Math.min(100, m.score.priority + 10),
        overall: Math.min(100, m.score.overall + 5),
      },
    };
  });

  const suggestedActions: MissionSuggestedAction[] = boosted.flatMap((m) =>
    buildSuggestedActions(m)
  );
  const automationProposals = filterSafeAutomationProposals(suggestedActions);

  const active = boosted.filter(
    (m) =>
      m.status === "ACTIVE" ||
      m.status === "PLANNING" ||
      m.status === "BLOCKED" ||
      m.status === "PAUSED"
  );

  return {
    missions: boosted,
    active,
    missionOfTheDay: progressed.missionOfTheDay,
    insights: boosted.flatMap((m) => m.insights),
    suggestedActions,
    automationProposals,
    meta: {
      generatedAt: new Date().toISOString(),
      plannerMs: planned.executionMs,
      progressMs: progressed.executionMs,
      totalMs: Date.now() - started,
      createdCount: planned.createdCount,
    },
  };
}

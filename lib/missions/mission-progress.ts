/**
 * Mission progress, score, insights, and mission-of-the-day.
 */

import {
  buildRecommendations,
  detectRuntimeRisks,
  inferStatusFromProgress,
} from "@/lib/missions/mission-rules";
import type {
  Mission,
  MissionInsight,
  MissionOfTheDay,
  MissionProgress,
  MissionProgressBreakdown,
  MissionScore,
  MissionModuleId,
} from "@/lib/missions/mission-types";

const MODULE_LABELS: Record<MissionModuleId, string> = {
  calendario: "Calendário",
  financeiro: "Financeiro",
  saude: "Saúde",
  habitos: "Hábitos",
  objetivos: "Objetivos",
  viagens: "Viagens",
  idiomas: "Idiomas",
  expert_brain: "Expert Brain",
  business_lab: "Business Lab",
  planner: "Planejamento",
  automation: "Automação",
  sistema: "Sistema",
};

export function computeMissionProgress(mission: Mission, asOf = new Date()): MissionProgress {
  const tasks = mission.tasks.filter((t) => t.status !== "cancelled");
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;
  const completedMilestones = mission.milestones.filter((m) => m.completed).length;
  const totalMilestones = mission.milestones.length;

  const taskPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const milestonePct =
    totalMilestones === 0
      ? taskPct
      : Math.round((completedMilestones / totalMilestones) * 100);

  const byModule = new Map<MissionModuleId, { done: number; total: number }>();
  for (const t of tasks) {
    const cur = byModule.get(t.moduleId) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (t.status === "done") cur.done += 1;
    byModule.set(t.moduleId, cur);
  }

  const breakdown: MissionProgressBreakdown[] = [];

  // Phase-based buckets (Planejamento, etc.)
  for (const phase of [...mission.phases].sort((a, b) => a.order - b.order)) {
    const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
    const done = phaseTasks.filter((t) => t.status === "done").length;
    const pct =
      phaseTasks.length === 0 ? 0 : Math.round((done / phaseTasks.length) * 100);
    breakdown.push({
      key: `phase:${phase.id}`,
      label: phase.title,
      pct,
      moduleId: phase.moduleIds[0] ?? null,
    });
  }

  // Module dimensions (Financeiro, Saúde, …)
  for (const [moduleId, stats] of byModule) {
    breakdown.push({
      key: `module:${moduleId}`,
      label: MODULE_LABELS[moduleId] ?? moduleId,
      pct: stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100),
      moduleId,
    });
  }

  const totalPct = Math.round(taskPct * 0.7 + milestonePct * 0.3);
  const estimatedTotalDays =
    mission.progress.estimatedTotalDays ||
    mission.phases.reduce((s, p) => s + p.estimatedDays, 0);

  let remainingDays: number | null = null;
  if (mission.targetDate) {
    remainingDays = Math.ceil(
      (new Date(mission.targetDate).getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    totalPct: clamp(totalPct, 0, 100),
    breakdown,
    completedTasks,
    totalTasks,
    completedMilestones,
    totalMilestones,
    remainingDays,
    estimatedTotalDays,
  };
}

export function computeMissionScore(mission: Mission, asOf = new Date()): MissionScore {
  const progress = mission.progress;
  const openRisks = mission.risks.filter((r) => r.status === "open");
  const riskPenalty = openRisks.reduce((s, r) => {
    if (r.level === "CRITICAL") return s + 35;
    if (r.level === "HIGH") return s + 20;
    if (r.level === "MEDIUM") return s + 10;
    return s + 4;
  }, 0);

  const risk = clamp(100 - riskPenalty, 0, 100);

  const blocked = mission.tasks.filter((t) => t.status === "blocked").length;
  const pending = mission.tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  ).length;
  const confidence = clamp(
    40 + progress.totalPct * 0.4 - blocked * 8 + (pending > 0 ? 5 : 0),
    0,
    100
  );

  let remainingTime = 50;
  if (progress.remainingDays != null && progress.estimatedTotalDays > 0) {
    const expectedPct =
      100 -
      (progress.remainingDays / Math.max(progress.estimatedTotalDays, 1)) * 100;
    const delta = progress.totalPct - expectedPct;
    remainingTime = clamp(50 + delta, 0, 100);
  }

  const daysSinceActivity = Math.max(
    0,
    Math.floor(
      (asOf.getTime() - new Date(mission.lastActivityAt).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const health = clamp(
    100 - daysSinceActivity * 8 - blocked * 10 - (mission.status === "BLOCKED" ? 25 : 0),
    0,
    100
  );

  const priority = clamp(mission.priority, 0, 100);
  const overall = Math.round(
    priority * 0.2 + risk * 0.2 + confidence * 0.2 + remainingTime * 0.2 + health * 0.2
  );

  return {
    priority,
    risk,
    confidence: Math.round(confidence),
    remainingTime: Math.round(remainingTime),
    health: Math.round(health),
    overall: clamp(overall, 0, 100),
  };
}

export function buildMissionInsights(mission: Mission, asOf = new Date()): MissionInsight[] {
  const insights: MissionInsight[] = [];
  const daysSince = Math.floor(
    (asOf.getTime() - new Date(mission.lastActivityAt).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (
    (mission.status === "ACTIVE" || mission.status === "PLANNING") &&
    daysSince >= 7 &&
    mission.progress.totalPct < 100
  ) {
    insights.push({
      id: `ins-stalled-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      kind: "stalled",
      title: "Esta missão está parada",
      description: `Sem atividade há ${daysSince} dias`,
      severity: daysSince >= 14 ? "HIGH" : "MEDIUM",
    });
  }

  if (mission.progress.totalPct > 0 && daysSince <= 2) {
    insights.push({
      id: `ins-prog-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      kind: "progressed",
      title: "Esta missão evoluiu",
      description: `Progresso em ${mission.progress.totalPct}%`,
      severity: "LOW",
    });
  }

  const highRisk = mission.risks.find(
    (r) => r.status === "open" && (r.level === "HIGH" || r.level === "CRITICAL")
  );
  if (highRisk) {
    insights.push({
      id: `ins-risk-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      kind: "at_risk",
      title: "Esta missão corre risco",
      description: highRisk.title,
      severity: highRisk.level,
    });
  }

  if (mission.score.remainingTime >= 70 && mission.progress.totalPct >= 30) {
    insights.push({
      id: `ins-ahead-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      kind: "ahead",
      title: "Esta missão está adiantada",
      description: "Ritmo acima do esperado para o prazo",
      severity: "LOW",
    });
  }

  if (mission.status === "BLOCKED") {
    insights.push({
      id: `ins-block-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      kind: "blocked",
      title: "Esta missão está bloqueada",
      description: "Dependências ou riscos críticos impedem avanço",
      severity: "HIGH",
    });
  }

  if (mission.status === "COMPLETED" || mission.progress.totalPct >= 100) {
    insights.push({
      id: `ins-done-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      kind: "completed",
      title: "Missão concluída",
      description: mission.title,
      severity: "LOW",
    });
  }

  return insights;
}

export function pickMissionOfTheDay(
  missions: Mission[],
  asOf = new Date()
): MissionOfTheDay | null {
  const candidates = missions.filter(
    (m) => m.status === "ACTIVE" || m.status === "PLANNING" || m.status === "BLOCKED"
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const scoreA = a.score.overall + a.priority * 0.3 - (a.status === "BLOCKED" ? 15 : 0);
    const scoreB = b.score.overall + b.priority * 0.3 - (b.status === "BLOCKED" ? 15 : 0);
    return scoreB - scoreA;
  });

  const mission = candidates[0];
  const openTasks = mission.tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  );
  const nextTask = openTasks[0] ?? null;
  const nextMilestone =
    mission.milestones.find((m) => !m.completed) ?? null;

  const remaining = Math.max(0, 100 - mission.progress.totalPct);
  const remainingDays = Math.max(1, mission.progress.remainingDays ?? 14);
  const expectedAdvancePct = Math.max(
    1,
    Math.min(15, Math.round(remaining / remainingDays) || Math.ceil(remaining / 10))
  );

  const message = `Hoje você avançará ${expectedAdvancePct}% na missão ${mission.title}`;

  void asOf;
  return {
    missionId: mission.id,
    missionTitle: mission.title,
    expectedAdvancePct,
    message,
    nextTask,
    nextMilestone,
  };
}

export function enrichMission(mission: Mission, asOf = new Date()): Mission {
  const progress = computeMissionProgress(mission, asOf);
  const phases = mission.phases.map((p) => {
    const phaseTasks = mission.tasks.filter(
      (t) => t.phaseId === p.id && t.status !== "cancelled"
    );
    const done = phaseTasks.filter((t) => t.status === "done").length;
    const progressPct =
      phaseTasks.length === 0 ? 0 : Math.round((done / phaseTasks.length) * 100);
    let status = p.status;
    if (progressPct >= 100) status = "done";
    else if (phaseTasks.some((t) => t.status === "blocked") && progressPct < 100)
      status = "blocked";
    else if (progressPct > 0) status = "active";
    return { ...p, progressPct, status };
  });

  let next: Mission = {
    ...mission,
    phases,
    progress,
    goals: mission.goals.map((g) =>
      g.unit === "%" ? { ...g, currentValue: progress.totalPct } : g
    ),
    metrics: mission.metrics.map((m) =>
      m.key === "progress" ? { ...m, value: progress.totalPct } : m
    ),
  };

  next = { ...next, risks: detectRuntimeRisks(next, asOf) };
  next = { ...next, score: computeMissionScore(next, asOf) };
  next = { ...next, insights: buildMissionInsights(next, asOf) };
  next = { ...next, recommendations: buildRecommendations(next) };
  next = { ...next, status: inferStatusFromProgress(next, asOf) };
  return next;
}

export type MissionProgressPassResult = {
  missions: Mission[];
  insights: MissionInsight[];
  missionOfTheDay: MissionOfTheDay | null;
  executionMs: number;
};

export function runMissionProgressPass(
  missions: Mission[],
  asOf = new Date()
): MissionProgressPassResult {
  const started = Date.now();
  const enriched = missions.map((m) => enrichMission(m, asOf));
  const insights = enriched.flatMap((m) => m.insights);
  return {
    missions: enriched,
    insights,
    missionOfTheDay: pickMissionOfTheDay(enriched, asOf),
    executionMs: Date.now() - started,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

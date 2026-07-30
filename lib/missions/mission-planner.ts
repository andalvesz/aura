/**
 * Mission planner — generates phases, milestones, tasks, risks, resources, deps.
 * Never executes risky actions. Never creates companies.
 */

import { resolveMissionTemplate } from "@/lib/missions/mission-templates";
import {
  applyDependencyBlocks,
  collectInvolvedModules,
  detectDependencies,
} from "@/lib/missions/mission-rules";
import type {
  BusinessExperimentDraft,
  BusinessHypothesisDraft,
  BusinessOpportunityDraft,
  Mission,
  MissionCreateInput,
  MissionMilestone,
  MissionPhase,
  MissionProgress,
  MissionResource,
  MissionRisk,
  MissionScore,
  MissionTask,
} from "@/lib/missions/mission-types";

const EMPTY_PROGRESS: MissionProgress = {
  totalPct: 0,
  breakdown: [],
  completedTasks: 0,
  totalTasks: 0,
  completedMilestones: 0,
  totalMilestones: 0,
  remainingDays: null,
  estimatedTotalDays: 0,
};

const EMPTY_SCORE: MissionScore = {
  priority: 50,
  risk: 20,
  confidence: 55,
  remainingTime: 50,
  health: 70,
  overall: 50,
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function estimateDurationDays(
  phases: { estimatedDays: number }[],
  overrideDays?: number | null
): number {
  if (overrideDays && overrideDays > 0) return overrideDays;
  return phases.reduce((s, p) => s + p.estimatedDays, 0);
}

export function planMissionFromInput(
  userId: string,
  input: MissionCreateInput,
  asOf = new Date()
): Mission {
  const template = resolveMissionTemplate(
    input.type,
    input.templateId,
    input.title
  );
  const missionId = uid("msn");
  const createdAt = asOf.toISOString();

  const phases: MissionPhase[] = [];
  const milestones: MissionMilestone[] = [];
  const tasks: MissionTask[] = [];

  let order = 0;
  for (const p of template.phases) {
    order += 1;
    const phaseId = uid("ph");
    phases.push({
      id: phaseId,
      missionId,
      order,
      title: p.title,
      description: p.description,
      status: order === 1 ? "active" : "pending",
      estimatedDays: p.estimatedDays,
      moduleIds: p.moduleIds,
      progressPct: 0,
    });

    let mOrder = 0;
    const phaseMilestoneIds: string[] = [];
    for (const mTitle of p.milestones) {
      mOrder += 1;
      const mid = uid("ms");
      phaseMilestoneIds.push(mid);
      milestones.push({
        id: mid,
        missionId,
        phaseId,
        order: mOrder,
        title: mTitle,
        dueDate: null,
        completed: false,
        completedAt: null,
      });
    }

    let tOrder = 0;
    for (const t of p.tasks) {
      tOrder += 1;
      const milestoneId =
        phaseMilestoneIds[
          Math.min(tOrder - 1, Math.max(phaseMilestoneIds.length - 1, 0))
        ] ?? null;
      tasks.push({
        id: uid("tsk"),
        missionId,
        phaseId,
        milestoneId,
        title: t.title,
        description: t.description,
        status: "pending",
        moduleId: t.moduleId,
        estimatedHours: t.estimatedHours,
        dueDate: null,
        blockedBy: [],
        riskLevel: t.riskLevel ?? "LOW",
      });
    }
  }

  const dependencies = detectDependencies(missionId, tasks);
  const tasksWithBlocks = applyDependencyBlocks(tasks, dependencies);

  const risks: MissionRisk[] = template.defaultRisks.map((r) => ({
    id: uid("rsk"),
    missionId,
    title: r.title,
    description: r.description,
    level: r.level,
    status: "open",
    relatedTaskIds: [],
    mitigation: r.mitigation,
  }));

  const resources: MissionResource[] = template.resources.map((r) => ({
    id: uid("res"),
    missionId,
    ...r,
  }));

  const estimatedTotalDays = estimateDurationDays(
    phases,
    daysFromRange(input.startDate ?? createdAt, input.targetDate ?? null)
  );

  let targetDate = input.targetDate ?? null;
  if (!targetDate) {
    const end = new Date(asOf);
    end.setDate(end.getDate() + estimatedTotalDays);
    targetDate = end.toISOString().slice(0, 10);
  }

  const modules = collectInvolvedModules({
    modules: template.modules,
    phases,
    tasks: tasksWithBlocks,
  });

  const business =
    input.type === "BUSINESS"
      ? buildBusinessDrafts(missionId, input.title)
      : undefined;

  const mission: Mission = {
    id: missionId,
    userId,
    workspaceId: input.workspaceId ?? null,
    title: input.title.trim() || template.title,
    description: (input.description ?? template.description).trim(),
    type: input.type,
    status: "PLANNING",
    priority: clamp(input.priority ?? 50, 0, 100),
    startDate: input.startDate ?? createdAt.slice(0, 10),
    targetDate,
    modules,
    goals: [
      {
        id: uid("goal"),
        missionId,
        title: `Concluir: ${input.title.trim() || template.title}`,
        targetValue: 100,
        currentValue: 0,
        unit: "%",
        dueDate: targetDate,
      },
    ],
    phases,
    milestones,
    tasks: tasksWithBlocks,
    risks,
    metrics: [
      {
        id: uid("met"),
        missionId,
        key: "progress",
        label: "Progresso",
        value: 0,
        target: 100,
        unit: "%",
      },
    ],
    dependencies,
    resources,
    recommendations: [],
    progress: {
      ...EMPTY_PROGRESS,
      estimatedTotalDays,
      remainingDays: daysFromRange(createdAt, targetDate),
      totalTasks: tasksWithBlocks.length,
      totalMilestones: milestones.length,
    },
    score: {
      ...EMPTY_SCORE,
      priority: clamp(input.priority ?? 50, 0, 100),
    },
    insights: [],
    business,
    createdAt,
    updatedAt: createdAt,
    lastActivityAt: createdAt,
    metadata: {
      templateId: template.id,
      ...(input.metadata ?? {}),
    },
  };

  return mission;
}

function buildBusinessDrafts(
  missionId: string,
  title: string
): NonNullable<Mission["business"]> {
  const hyp: BusinessHypothesisDraft = {
    id: uid("hyp"),
    missionId,
    statement: `Existe demanda suficiente para "${title}" a um preço sustentável.`,
    evidence: [],
  };
  const opp: BusinessOpportunityDraft = {
    id: uid("opp"),
    missionId,
    title: `Oportunidade: ${title}`,
    problem: "A validar com entrevistas e experimentos",
    audience: "A definir na fase de descoberta",
  };
  const exp: BusinessExperimentDraft = {
    id: uid("exp"),
    missionId,
    hypothesisId: hyp.id,
    method: "Entrevistas + landing de interesse (rascunho)",
    status: "planned",
  };
  return {
    hypotheses: [hyp],
    experiments: [exp],
    opportunities: [opp],
  };
}

function daysFromRange(start: string, end: string | null): number | null {
  if (!end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export type MissionPlannerResult = {
  missions: Mission[];
  createdCount: number;
  executionMs: number;
};

export function runMissionPlanner(input: {
  userId: string;
  existing: Mission[];
  create?: MissionCreateInput[];
  asOf?: string;
}): MissionPlannerResult {
  const started = Date.now();
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  const created = (input.create ?? []).map((c) =>
    planMissionFromInput(input.userId, c, asOf)
  );
  return {
    missions: [...input.existing, ...created],
    createdCount: created.length,
    executionMs: Date.now() - started,
  };
}

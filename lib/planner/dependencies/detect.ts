/**
 * Dependency / cycle detection — never auto-correct; surface for human review.
 */

import {
  newPlanId,
  type PlanDependencyIssue,
  type PlanStep,
} from "@/lib/planner/types/types";

export function detectCircularDependencies(
  steps: Pick<PlanStep, "id" | "dependsOn">[]
): string[][] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(id: string): void {
    if (visiting.has(id)) {
      const idx = stack.indexOf(id);
      cycles.push(idx >= 0 ? stack.slice(idx).concat(id) : [id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    const step = byId.get(id);
    for (const dep of step?.dependsOn ?? []) {
      if (byId.has(dep)) dfs(dep);
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const s of steps) dfs(s.id);
  return cycles;
}

export function topologicalOrder(
  steps: Pick<PlanStep, "id" | "dependsOn" | "order">[]
): { order: string[]; hasCycle: boolean } {
  const cycles = detectCircularDependencies(steps);
  if (cycles.length) return { order: steps.map((s) => s.id), hasCycle: true };

  const indeg = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const s of steps) {
    indeg.set(s.id, 0);
    children.set(s.id, []);
  }
  for (const s of steps) {
    for (const d of s.dependsOn) {
      if (!indeg.has(d)) continue;
      indeg.set(s.id, (indeg.get(s.id) ?? 0) + 1);
      children.get(d)!.push(s.id);
    }
  }
  const queue = [...steps]
    .filter((s) => (indeg.get(s.id) ?? 0) === 0)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const c of children.get(id) ?? []) {
      indeg.set(c, (indeg.get(c) ?? 1) - 1);
      if (indeg.get(c) === 0) queue.push(c);
    }
  }
  return { order, hasCycle: order.length !== steps.length };
}

export function analyzePlanDependencies(input: {
  planId: string;
  steps: PlanStep[];
  hasOwner: boolean;
  resourceTitles: string[];
  missingResourceTitles?: string[];
  gaps?: string[];
}): PlanDependencyIssue[] {
  const issues: PlanDependencyIssue[] = [];
  const cycles = detectCircularDependencies(input.steps);
  for (const cycle of cycles) {
    issues.push({
      id: newPlanId("pdi"),
      planId: input.planId,
      kind: "circular",
      summary: `Dependência circular detectada: ${cycle.join(" → ")}. Revisão humana necessária.`,
      relatedStepIds: cycle.filter((id) =>
        input.steps.some((s) => s.id === id)
      ),
      requiresHumanReview: true,
    });
  }

  for (const step of input.steps) {
    for (const dep of step.dependsOn) {
      if (!input.steps.some((s) => s.id === dep)) {
        issues.push({
          id: newPlanId("pdi"),
          planId: input.planId,
          kind: "step_dependency",
          summary: `Etapa "${step.title}" depende de id ausente (${dep}).`,
          relatedStepIds: [step.id],
          requiresHumanReview: true,
        });
      }
    }
    if (!step.ownerId && !input.hasOwner) {
      issues.push({
        id: newPlanId("pdi"),
        planId: input.planId,
        kind: "missing_owner",
        summary: `Etapa "${step.title}" sem responsável sugerido.`,
        relatedStepIds: [step.id],
        requiresHumanReview: true,
      });
    }
  }

  for (const title of input.missingResourceTitles ?? []) {
    issues.push({
      id: newPlanId("pdi"),
      planId: input.planId,
      kind: "missing_resource",
      summary: `Recurso ausente: ${title}.`,
      relatedStepIds: [],
      requiresHumanReview: true,
    });
  }

  // Deadline incompatibility: step deadline before dependency deadline
  const byId = new Map(input.steps.map((s) => [s.id, s]));
  for (const step of input.steps) {
    if (!step.suggestedDeadline) continue;
    for (const depId of step.dependsOn) {
      const dep = byId.get(depId);
      if (
        dep?.suggestedDeadline &&
        step.suggestedDeadline < dep.suggestedDeadline
      ) {
        issues.push({
          id: newPlanId("pdi"),
          planId: input.planId,
          kind: "incompatible_deadline",
          summary: `Prazo de "${step.title}" anterior ao de "${dep.title}".`,
          relatedStepIds: [step.id, dep.id],
          requiresHumanReview: true,
        });
      }
    }
  }

  if ((input.gaps ?? []).length >= 5) {
    issues.push({
      id: newPlanId("pdi"),
      planId: input.planId,
      kind: "insufficient_information",
      summary: `Informação insuficiente no contexto (${input.gaps!.slice(0, 3).join(", ")}…).`,
      relatedStepIds: [],
      requiresHumanReview: true,
    });
  }

  void input.resourceTitles;
  return issues;
}

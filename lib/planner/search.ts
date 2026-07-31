import {
  canViewPlan,
  type Plan,
  type PlanState,
} from "@/lib/planner/types/types";

export type PlanSearchHit = {
  kind: "plan" | "step" | "milestone" | "risk" | "resource";
  planId: string;
  title: string;
  snippet: string;
};

export function searchPlansPure(
  state: PlanState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  query: string,
  opts?: { limit?: number }
): PlanSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: PlanSearchHit[] = [];
  const plans = state.plans.filter(
    (p) => !p.softDeleted && canViewPlan(p, viewer)
  );

  for (const p of plans) {
    const planBlob = [p.title, p.summary, p.objective, ...p.limitations]
      .join(" ")
      .toLowerCase();
    if (planBlob.includes(q)) {
      hits.push({
        kind: "plan",
        planId: p.id,
        title: p.title,
        snippet: p.summary,
      });
    }
    for (const s of p.steps) {
      if (`${s.title} ${s.description}`.toLowerCase().includes(q)) {
        hits.push({
          kind: "step",
          planId: p.id,
          title: s.title,
          snippet: s.description,
        });
      }
    }
    for (const m of p.milestones) {
      if (`${m.title} ${m.description}`.toLowerCase().includes(q)) {
        hits.push({
          kind: "milestone",
          planId: p.id,
          title: m.title,
          snippet: m.description,
        });
      }
    }
    for (const r of p.risks) {
      if (`${r.title} ${r.mitigationSuggested}`.toLowerCase().includes(q)) {
        hits.push({
          kind: "risk",
          planId: p.id,
          title: r.title,
          snippet: r.mitigationSuggested,
        });
      }
    }
    for (const r of p.resources) {
      if (`${r.title} ${r.description}`.toLowerCase().includes(q)) {
        hits.push({
          kind: "resource",
          planId: p.id,
          title: r.title,
          snippet: r.description,
        });
      }
    }
  }
  return hits.slice(0, opts?.limit ?? 40);
}

export function searchPlanEntitiesPure(
  state: PlanState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  query: string,
  opts?: { limit?: number }
): Plan[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return state.plans
    .filter((p) => !p.softDeleted && canViewPlan(p, viewer))
    .filter((p) =>
      [p.title, p.summary, p.objective].join(" ").toLowerCase().includes(q)
    )
    .slice(0, opts?.limit ?? 30);
}

/**
 * Business Hub pure engine — companies linked to projects.
 */

import { newProjectId, type BusinessCompany, type BusinessSegment, type CreateBusinessInput, type ProjectsState } from "@/lib/projects/types";

function nowIso(): string {
  return new Date().toISOString();
}

export function createBusinessPure(
  state: ProjectsState,
  input: CreateBusinessInput & { ownerUserId: string }
): { state: ProjectsState; business: BusinessCompany | null; error: string | null } {
  const name = input.name?.trim();
  if (!name) {
    return {
      state,
      business: null,
      error: "Nome obrigatório",
    };
  }
  const ts = nowIso();
  const business: BusinessCompany = {
    id: newProjectId("biz"),
    name,
    segment: input.segment ?? "other",
    description: (input.description ?? "").trim(),
    workspaceId: input.workspaceId ?? null,
    ownerUserId: input.ownerUserId,
    projectIds: [],
    createdAt: ts,
    updatedAt: ts,
  };
  return {
    state: { ...state, businesses: [business, ...state.businesses] },
    business,
    error: null,
  };
}

export function listBusinessesPure(
  state: ProjectsState,
  userId: string,
  opts?: { workspaceId?: string | null; limit?: number }
): BusinessCompany[] {
  let rows = state.businesses.filter(
    (b) =>
      b.ownerUserId === userId ||
      (opts?.workspaceId != null && b.workspaceId === opts.workspaceId)
  );
  rows = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows.slice(0, opts?.limit ?? 50);
}

export function getBusinessPure(
  state: ProjectsState,
  businessId: string
): BusinessCompany | null {
  return state.businesses.find((b) => b.id === businessId) ?? null;
}

export function searchBusinessesPure(
  state: ProjectsState,
  userId: string,
  query: string,
  opts?: { workspaceId?: string | null; limit?: number }
): BusinessCompany[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return listBusinessesPure(state, userId, opts).filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.segment.toLowerCase().includes(q)
  );
}

export const BUSINESS_SEGMENT_LABELS: Record<BusinessSegment, string> = {
  saas: "SaaS",
  agency: "Agência",
  ecommerce: "E-commerce",
  consulting: "Consultoria",
  content: "Conteúdo",
  other: "Outro",
};

/**
 * Projects pure engine — CRUD, members, memory links, status board.
 */

import {
  canEditProject,
  canViewProject,
  newProjectId,
  type CreateProjectInput,
  type Project,
  type ProjectMember,
  type ProjectMemberRole,
  type ProjectStatus,
  type ProjectsState,
  type ProjectTimelineEvent,
  type UpdateProjectInput,
} from "@/lib/projects/types";

function nowIso(): string {
  return new Date().toISOString();
}

function pushTimeline(
  state: ProjectsState,
  event: {
    projectId: string;
    kind: ProjectTimelineEvent["kind"];
    title: string;
    summary: string;
    actorUserId: string;
    href?: string | null;
    relatedType?: string | null;
    relatedId?: string | null;
    createdAt?: string;
  }
): ProjectsState {
  const row: ProjectTimelineEvent = {
    id: newProjectId("ptl"),
    createdAt: event.createdAt ?? nowIso(),
    projectId: event.projectId,
    kind: event.kind,
    title: event.title,
    summary: event.summary,
    actorUserId: event.actorUserId,
    href: event.href ?? null,
    relatedType: event.relatedType ?? null,
    relatedId: event.relatedId ?? null,
  };
  return {
    ...state,
    timeline: [row, ...state.timeline].slice(0, 500),
  };
}

export function createProjectPure(
  state: ProjectsState,
  input: CreateProjectInput & { ownerUserId: string }
): { state: ProjectsState; project: Project | null; error: string | null } {
  const name = input.name?.trim();
  if (!name) return { state, project: null, error: "Nome obrigatório" };

  const ts = nowIso();
  const owner: ProjectMember = {
    userId: input.ownerUserId,
    role: "owner",
    addedAt: ts,
    addedBy: input.ownerUserId,
  };
  const project: Project = {
    id: newProjectId("prj"),
    name,
    description: (input.description ?? "").trim(),
    status: input.status ?? "idea",
    workspaceId: input.workspaceId ?? null,
    ownerUserId: input.ownerUserId,
    members: [owner],
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    color: input.color ?? "#22d3ee",
    icon: input.icon ?? "folder",
    favorite: Boolean(input.favorite),
    archived: false,
    businessId: input.businessId ?? null,
    memoryIds: [],
    createdAt: ts,
    updatedAt: ts,
  };

  let next: ProjectsState = {
    ...state,
    projects: [project, ...state.projects],
  };
  next = pushTimeline(next, {
    projectId: project.id,
    kind: "project_created",
    title: `Projeto criado: ${project.name}`,
    summary: project.description.slice(0, 160),
    actorUserId: input.ownerUserId,
    href: `/dashboard/projects/${project.id}`,
  });

  if (project.businessId) {
    next = {
      ...next,
      businesses: next.businesses.map((b) =>
        b.id === project.businessId
          ? {
              ...b,
              projectIds: b.projectIds.includes(project.id)
                ? b.projectIds
                : [...b.projectIds, project.id],
              updatedAt: ts,
            }
          : b
      ),
    };
  }

  return { state: next, project, error: null };
}

export function updateProjectPure(
  state: ProjectsState,
  userId: string,
  input: UpdateProjectInput
): { state: ProjectsState; project: Project | null; error: string | null } {
  const idx = state.projects.findIndex((p) => p.id === input.projectId);
  if (idx < 0) return { state, project: null, error: "Projeto não encontrado" };
  const current = state.projects[idx];
  if (!canEditProject(current, userId)) {
    return { state, project: null, error: "Sem permissão" };
  }

  const ts = nowIso();
  const updated: Project = {
    ...current,
    name: input.name?.trim() ?? current.name,
    description:
      input.description !== undefined
        ? input.description.trim()
        : current.description,
    status: input.status ?? current.status,
    tags: input.tags ?? current.tags,
    color: input.color ?? current.color,
    icon: input.icon ?? current.icon,
    favorite: input.favorite ?? current.favorite,
    archived: input.archived ?? current.archived,
    businessId:
      input.businessId !== undefined ? input.businessId : current.businessId,
    updatedAt: ts,
  };

  let next: ProjectsState = {
    ...state,
    projects: state.projects.map((p, i) => (i === idx ? updated : p)),
  };

  if (input.status && input.status !== current.status) {
    next = pushTimeline(next, {
      projectId: updated.id,
      kind: "status_changed",
      title: `Status: ${current.status} → ${updated.status}`,
      summary: updated.name,
      actorUserId: userId,
      href: `/dashboard/projects/${updated.id}`,
    });
  } else {
    next = pushTimeline(next, {
      projectId: updated.id,
      kind: "project_updated",
      title: `Projeto atualizado: ${updated.name}`,
      summary: "",
      actorUserId: userId,
      href: `/dashboard/projects/${updated.id}`,
    });
  }

  return { state: next, project: updated, error: null };
}

export function setProjectStatusPure(
  state: ProjectsState,
  userId: string,
  projectId: string,
  status: ProjectStatus
): { state: ProjectsState; project: Project | null; error: string | null } {
  return updateProjectPure(state, userId, { projectId, status });
}

export function addProjectMemberPure(
  state: ProjectsState,
  actorUserId: string,
  projectId: string,
  memberUserId: string,
  role: ProjectMemberRole
): { state: ProjectsState; project: Project | null; error: string | null } {
  const idx = state.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return { state, project: null, error: "Projeto não encontrado" };
  const current = state.projects[idx];
  if (current.ownerUserId !== actorUserId) {
    const actor = current.members.find((m) => m.userId === actorUserId);
    if (actor?.role !== "owner") {
      return { state, project: null, error: "Apenas owner pode adicionar membros" };
    }
  }
  if (current.members.some((m) => m.userId === memberUserId)) {
    return { state, project: null, error: "Membro já existe" };
  }
  if (role === "owner") {
    return { state, project: null, error: "Use transferência de ownership" };
  }

  const ts = nowIso();
  const member: ProjectMember = {
    userId: memberUserId,
    role,
    addedAt: ts,
    addedBy: actorUserId,
  };
  const updated: Project = {
    ...current,
    members: [...current.members, member],
    updatedAt: ts,
  };
  let next: ProjectsState = {
    ...state,
    projects: state.projects.map((p, i) => (i === idx ? updated : p)),
  };
  next = pushTimeline(next, {
    projectId,
    kind: "member_added",
    title: `Membro adicionado (${role})`,
    summary: memberUserId,
    actorUserId,
    href: `/dashboard/projects/${projectId}`,
    relatedType: "member",
    relatedId: memberUserId,
  });
  return { state: next, project: updated, error: null };
}

export function removeProjectMemberPure(
  state: ProjectsState,
  actorUserId: string,
  projectId: string,
  memberUserId: string
): { state: ProjectsState; project: Project | null; error: string | null } {
  const idx = state.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return { state, project: null, error: "Projeto não encontrado" };
  const current = state.projects[idx];
  if (current.ownerUserId !== actorUserId) {
    return { state, project: null, error: "Apenas owner pode remover membros" };
  }
  if (memberUserId === current.ownerUserId) {
    return { state, project: null, error: "Não remova o owner" };
  }
  const ts = nowIso();
  const updated: Project = {
    ...current,
    members: current.members.filter((m) => m.userId !== memberUserId),
    updatedAt: ts,
  };
  let next: ProjectsState = {
    ...state,
    projects: state.projects.map((p, i) => (i === idx ? updated : p)),
  };
  next = pushTimeline(next, {
    projectId,
    kind: "member_removed",
    title: "Membro removido",
    summary: memberUserId,
    actorUserId,
    href: `/dashboard/projects/${projectId}`,
  });
  return { state: next, project: updated, error: null };
}

export function linkMemoryToProjectPure(
  state: ProjectsState,
  userId: string,
  projectId: string,
  memoryId: string
): { state: ProjectsState; project: Project | null; error: string | null } {
  const idx = state.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return { state, project: null, error: "Projeto não encontrado" };
  const current = state.projects[idx];
  if (!canEditProject(current, userId)) {
    return { state, project: null, error: "Sem permissão" };
  }
  if (current.memoryIds.includes(memoryId)) {
    return { state, project: current, error: null };
  }
  // A memory belongs to at most one project — unlink elsewhere
  let projects = state.projects.map((p) => {
    if (p.id === projectId) return p;
    if (!p.memoryIds.includes(memoryId)) return p;
    return {
      ...p,
      memoryIds: p.memoryIds.filter((id) => id !== memoryId),
      updatedAt: nowIso(),
    };
  });
  const ts = nowIso();
  const updated: Project = {
    ...current,
    memoryIds: [...current.memoryIds, memoryId],
    updatedAt: ts,
  };
  projects = projects.map((p) => (p.id === projectId ? updated : p));
  let next: ProjectsState = { ...state, projects };
  next = pushTimeline(next, {
    projectId,
    kind: "memory_linked",
    title: "Memória vinculada",
    summary: memoryId,
    actorUserId: userId,
    href: `/dashboard/projects/${projectId}`,
    relatedType: "memory",
    relatedId: memoryId,
  });
  return { state: next, project: updated, error: null };
}

export function unlinkMemoryFromProjectPure(
  state: ProjectsState,
  userId: string,
  projectId: string,
  memoryId: string
): { state: ProjectsState; project: Project | null; error: string | null } {
  const idx = state.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return { state, project: null, error: "Projeto não encontrado" };
  const current = state.projects[idx];
  if (!canEditProject(current, userId)) {
    return { state, project: null, error: "Sem permissão" };
  }
  const ts = nowIso();
  const updated: Project = {
    ...current,
    memoryIds: current.memoryIds.filter((id) => id !== memoryId),
    updatedAt: ts,
  };
  let next: ProjectsState = {
    ...state,
    projects: state.projects.map((p, i) => (i === idx ? updated : p)),
  };
  next = pushTimeline(next, {
    projectId,
    kind: "memory_unlinked",
    title: "Memória desvinculada",
    summary: memoryId,
    actorUserId: userId,
    href: `/dashboard/projects/${projectId}`,
    relatedType: "memory",
    relatedId: memoryId,
  });
  return { state: next, project: updated, error: null };
}

export function listProjectsPure(
  state: ProjectsState,
  userId: string,
  opts?: {
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
    includeArchived?: boolean;
    status?: ProjectStatus;
    favoriteOnly?: boolean;
    businessId?: string | null;
    limit?: number;
    offset?: number;
  }
): Project[] {
  let rows = state.projects.filter((p) =>
    canViewProject(p, userId, {
      workspaceId: opts?.workspaceId,
      isWorkspaceMember: opts?.isWorkspaceMember,
    })
  );
  if (!opts?.includeArchived) {
    rows = rows.filter((p) => !p.archived && p.status !== "archived");
  }
  if (opts?.status) rows = rows.filter((p) => p.status === opts.status);
  if (opts?.favoriteOnly) rows = rows.filter((p) => p.favorite);
  if (opts?.businessId) {
    rows = rows.filter((p) => p.businessId === opts.businessId);
  }
  rows = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;
  return rows.slice(offset, offset + limit);
}

export function getProjectPure(
  state: ProjectsState,
  userId: string,
  projectId: string,
  opts?: { workspaceId?: string | null; isWorkspaceMember?: boolean }
): Project | null {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return null;
  if (!canViewProject(p, userId, opts)) return null;
  return p;
}

export function findProjectForMemoryPure(
  state: ProjectsState,
  memoryId: string
): Project | null {
  return state.projects.find((p) => p.memoryIds.includes(memoryId)) ?? null;
}

export function listProjectTimelinePure(
  state: ProjectsState,
  projectId: string,
  limit = 50
): ProjectTimelineEvent[] {
  return state.timeline
    .filter((e) => e.projectId === projectId)
    .slice(0, limit);
}

export function groupProjectsByStatus(
  projects: Project[]
): Record<ProjectStatus, Project[]> {
  const out: Record<ProjectStatus, Project[]> = {
    idea: [],
    planning: [],
    active: [],
    paused: [],
    done: [],
    archived: [],
  };
  for (const p of projects) {
    out[p.status].push(p);
  }
  return out;
}

export function searchProjectsPure(
  state: ProjectsState,
  userId: string,
  query: string,
  opts?: { workspaceId?: string | null; isWorkspaceMember?: boolean; limit?: number }
): Project[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return listProjectsPure(state, userId, {
    ...opts,
    includeArchived: true,
    limit: opts?.limit ?? 20,
  }).filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
  );
}

/**
 * Projects & Business OS service facade (RC4).
 * executionInfluence: "none"
 */

import {
  addProjectDocumentPure,
  listProjectDocumentsPure,
  searchProjectDocumentsPure,
} from "@/lib/projects/documents";
import {
  createBusinessPure,
  getBusinessPure,
  listBusinessesPure,
  searchBusinessesPure,
} from "@/lib/projects/business";
import {
  addProjectMemberPure,
  createProjectPure,
  findProjectForMemoryPure,
  getProjectPure,
  groupProjectsByStatus,
  linkMemoryToProjectPure,
  listProjectTimelinePure,
  listProjectsPure,
  removeProjectMemberPure,
  searchProjectsPure,
  setProjectStatusPure,
  unlinkMemoryFromProjectPure,
  updateProjectPure,
} from "@/lib/projects/engine";
import { filterDiscoveriesForProject } from "@/lib/projects/discovery";
import {
  getProjectsState,
  projectsStoreKey,
  setProjectsState,
} from "@/lib/projects/store";
import type {
  BusinessCompany,
  CreateBusinessInput,
  CreateProjectInput,
  Project,
  ProjectDocument,
  ProjectDocumentKind,
  ProjectMemberRole,
  ProjectStatus,
  ProjectTimelineEvent,
  UpdateProjectInput,
} from "@/lib/projects/types";
import { getDataContext } from "@/lib/supabase/services/context";
import { listDiscoveries } from "@/lib/supabase/services/discovery-engine.service";
import { listMemories } from "@/lib/supabase/services/memory-engine.service";
import { toggleFavorite } from "@/lib/supabase/services/daily-ops.service";
import type { DiscoveryArtifact } from "@/lib/discovery/types";

function keyFromCtx(userId: string, workspaceId: string | null): string {
  return projectsStoreKey(userId, workspaceId);
}

async function ctxKey() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  return {
    ctx,
    ws,
    key: keyFromCtx(ctx.userId, ws),
    access: {
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

export async function createProject(input: CreateProjectInput): Promise<{
  project: Project | null;
  error: string | null;
}> {
  const { ctx, ws, key } = await ctxKey();
  const res = createProjectPure(getProjectsState(key), {
    ...input,
    workspaceId: input.workspaceId !== undefined ? input.workspaceId : ws,
    ownerUserId: ctx.userId,
  });
  if (res.error) return { project: null, error: res.error };
  setProjectsState(key, res.state);
  return { project: res.project, error: null };
}

export async function updateProject(input: UpdateProjectInput): Promise<{
  project: Project | null;
  error: string | null;
}> {
  const { ctx, key } = await ctxKey();
  const res = updateProjectPure(getProjectsState(key), ctx.userId, input);
  if (res.error) return { project: null, error: res.error };
  setProjectsState(key, res.state);
  return { project: res.project, error: null };
}

export async function setProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<{ project: Project | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = setProjectStatusPure(
    getProjectsState(key),
    ctx.userId,
    projectId,
    status
  );
  if (res.error) return { project: null, error: res.error };
  setProjectsState(key, res.state);
  return { project: res.project, error: null };
}

export async function listProjects(opts?: {
  includeArchived?: boolean;
  status?: ProjectStatus;
  favoriteOnly?: boolean;
  businessId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<Project[]> {
  const { ctx, key, access } = await ctxKey();
  return listProjectsPure(getProjectsState(key), ctx.userId, {
    ...access,
    ...opts,
  });
}

export async function getProject(projectId: string): Promise<Project | null> {
  const { ctx, key, access } = await ctxKey();
  return getProjectPure(getProjectsState(key), ctx.userId, projectId, access);
}

export async function getProjectsBoard(): Promise<
  Record<ProjectStatus, Project[]>
> {
  const projects = await listProjects({ includeArchived: false, limit: 200 });
  return groupProjectsByStatus(projects);
}

export async function toggleProjectFavorite(projectId: string): Promise<{
  project: Project | null;
  error: string | null;
}> {
  const project = await getProject(projectId);
  if (!project) return { project: null, error: "Projeto não encontrado" };
  const nextFavorite = !project.favorite;
  const updated = await updateProject({
    projectId,
    favorite: nextFavorite,
  });
  await toggleFavorite({
    targetType: "project",
    targetId: projectId,
    title: project.name,
    href: `/dashboard/projects/${projectId}`,
  });
  return updated;
}

export async function addProjectMember(input: {
  projectId: string;
  memberUserId: string;
  role: ProjectMemberRole;
}): Promise<{ project: Project | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = addProjectMemberPure(
    getProjectsState(key),
    ctx.userId,
    input.projectId,
    input.memberUserId,
    input.role
  );
  if (res.error) return { project: null, error: res.error };
  setProjectsState(key, res.state);
  return { project: res.project, error: null };
}

export async function removeProjectMember(input: {
  projectId: string;
  memberUserId: string;
}): Promise<{ project: Project | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = removeProjectMemberPure(
    getProjectsState(key),
    ctx.userId,
    input.projectId,
    input.memberUserId
  );
  if (res.error) return { project: null, error: res.error };
  setProjectsState(key, res.state);
  return { project: res.project, error: null };
}

export async function linkMemoryToProject(input: {
  projectId: string;
  memoryId: string;
}): Promise<{ project: Project | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = linkMemoryToProjectPure(
    getProjectsState(key),
    ctx.userId,
    input.projectId,
    input.memoryId
  );
  if (res.error) return { project: null, error: res.error };
  setProjectsState(key, res.state);
  return { project: res.project, error: null };
}

export async function unlinkMemoryFromProject(input: {
  projectId: string;
  memoryId: string;
}): Promise<{ project: Project | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = unlinkMemoryFromProjectPure(
    getProjectsState(key),
    ctx.userId,
    input.projectId,
    input.memoryId
  );
  if (res.error) return { project: null, error: res.error };
  setProjectsState(key, res.state);
  return { project: res.project, error: null };
}

export async function findProjectForMemory(
  memoryId: string
): Promise<Project | null> {
  const { key } = await ctxKey();
  return findProjectForMemoryPure(getProjectsState(key), memoryId);
}

export async function listProjectTimeline(
  projectId: string,
  limit = 50
): Promise<ProjectTimelineEvent[]> {
  const project = await getProject(projectId);
  if (!project) return [];
  const { key } = await ctxKey();
  return listProjectTimelinePure(getProjectsState(key), projectId, limit);
}

export async function addProjectDocument(input: {
  projectId: string;
  kind: ProjectDocumentKind;
  title?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  ocrText?: string | null;
}): Promise<{ document: ProjectDocument | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = addProjectDocumentPure(getProjectsState(key), {
    userId: ctx.userId,
    ...input,
  });
  if (res.error) return { document: null, error: res.error };
  setProjectsState(key, res.state);
  return { document: res.document, error: null };
}

export async function listProjectDocuments(
  projectId: string
): Promise<ProjectDocument[]> {
  const project = await getProject(projectId);
  if (!project) return [];
  const { key } = await ctxKey();
  return listProjectDocumentsPure(getProjectsState(key), projectId);
}

export async function searchProjectDocuments(
  query: string,
  projectId?: string
): Promise<ProjectDocument[]> {
  const { key } = await ctxKey();
  return searchProjectDocumentsPure(getProjectsState(key), query, { projectId });
}

export async function listProjectDiscoveries(
  projectId: string
): Promise<DiscoveryArtifact[]> {
  const project = await getProject(projectId);
  if (!project) return [];
  try {
    const arts = await listDiscoveries({ limit: 80 });
    return filterDiscoveriesForProject(arts, projectId, {
      memoryIds: project.memoryIds,
    });
  } catch {
    return [];
  }
}

export async function listProjectMemories(projectId: string) {
  const project = await getProject(projectId);
  if (!project) return [];
  try {
    const all = await listMemories({ limit: 80 });
    return all.filter(
      (m) =>
        project.memoryIds.includes(m.id) ||
        (m.metadata as { projectId?: string } | undefined)?.projectId ===
          projectId
    );
  } catch {
    return [];
  }
}

export async function createBusiness(input: CreateBusinessInput): Promise<{
  business: BusinessCompany | null;
  error: string | null;
}> {
  const { ctx, ws, key } = await ctxKey();
  const res = createBusinessPure(getProjectsState(key), {
    ...input,
    workspaceId: input.workspaceId !== undefined ? input.workspaceId : ws,
    ownerUserId: ctx.userId,
  });
  if (res.error) return { business: null, error: res.error };
  setProjectsState(key, res.state);
  return { business: res.business, error: null };
}

export async function listBusinesses(): Promise<BusinessCompany[]> {
  const { ctx, key, ws } = await ctxKey();
  return listBusinessesPure(getProjectsState(key), ctx.userId, {
    workspaceId: ws,
  });
}

export async function getBusiness(
  businessId: string
): Promise<BusinessCompany | null> {
  const { key } = await ctxKey();
  return getBusinessPure(getProjectsState(key), businessId);
}

export async function searchProjectsAndBusiness(query: string): Promise<{
  projects: Project[];
  businesses: BusinessCompany[];
  documents: ProjectDocument[];
}> {
  const { ctx, key, access, ws } = await ctxKey();
  const state = getProjectsState(key);
  return {
    projects: searchProjectsPure(state, ctx.userId, query, access),
    businesses: searchBusinessesPure(state, ctx.userId, query, {
      workspaceId: ws,
    }),
    documents: searchProjectDocumentsPure(state, query),
  };
}

export async function getHomeProjectsWidget(): Promise<{
  active: Project[];
  recent: Project[];
  favorites: Project[];
}> {
  const all = await listProjects({ limit: 40 });
  return {
    active: all.filter((p) => p.status === "active").slice(0, 6),
    recent: all.slice(0, 6),
    favorites: all.filter((p) => p.favorite).slice(0, 6),
  };
}

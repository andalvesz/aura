"use server";

import { revalidatePath } from "next/cache";
import {
  addProjectDocument,
  addProjectMember,
  createBusiness,
  createProject,
  getBusiness,
  getHomeProjectsWidget,
  getProject,
  getProjectsBoard,
  linkMemoryToProject,
  listBusinesses,
  listProjectDiscoveries,
  listProjectDocuments,
  listProjectMemories,
  listProjectTimeline,
  listProjects,
  removeProjectMember,
  searchProjectDocuments,
  searchProjectsAndBusiness,
  setProjectStatus,
  toggleProjectFavorite,
  unlinkMemoryFromProject,
  updateProject,
} from "@/lib/supabase/services/projects.service";
import type {
  CreateBusinessInput,
  CreateProjectInput,
  ProjectDocumentKind,
  ProjectMemberRole,
  ProjectStatus,
  UpdateProjectInput,
} from "@/lib/projects/types";

function revalidateProjects(projectId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/business");
  revalidatePath("/dashboard/favorites");
  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/dashboard/projects/${projectId}/documents`);
  }
}

export async function createProjectAction(input: CreateProjectInput) {
  const res = await createProject(input);
  revalidateProjects(res.project?.id);
  return res;
}

export async function updateProjectAction(input: UpdateProjectInput) {
  const res = await updateProject(input);
  revalidateProjects(input.projectId);
  return res;
}

export async function setProjectStatusAction(
  projectId: string,
  status: ProjectStatus
) {
  const res = await setProjectStatus(projectId, status);
  revalidateProjects(projectId);
  return res;
}

export async function listProjectsAction(opts?: {
  includeArchived?: boolean;
  status?: ProjectStatus;
  favoriteOnly?: boolean;
  businessId?: string | null;
  limit?: number;
}) {
  return listProjects(opts);
}

export async function getProjectAction(projectId: string) {
  return getProject(projectId);
}

export async function getProjectsBoardAction() {
  return getProjectsBoard();
}

export async function toggleProjectFavoriteAction(projectId: string) {
  const res = await toggleProjectFavorite(projectId);
  revalidateProjects(projectId);
  return res;
}

export async function addProjectMemberAction(input: {
  projectId: string;
  memberUserId: string;
  role: ProjectMemberRole;
}) {
  const res = await addProjectMember(input);
  revalidateProjects(input.projectId);
  return res;
}

export async function removeProjectMemberAction(input: {
  projectId: string;
  memberUserId: string;
}) {
  const res = await removeProjectMember(input);
  revalidateProjects(input.projectId);
  return res;
}

export async function linkMemoryToProjectAction(input: {
  projectId: string;
  memoryId: string;
}) {
  const res = await linkMemoryToProject(input);
  revalidateProjects(input.projectId);
  return res;
}

export async function unlinkMemoryFromProjectAction(input: {
  projectId: string;
  memoryId: string;
}) {
  const res = await unlinkMemoryFromProject(input);
  revalidateProjects(input.projectId);
  return res;
}

export async function listProjectTimelineAction(
  projectId: string,
  limit?: number
) {
  return listProjectTimeline(projectId, limit);
}

export async function addProjectDocumentAction(input: {
  projectId: string;
  kind: ProjectDocumentKind;
  title?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  ocrText?: string | null;
}) {
  const res = await addProjectDocument(input);
  revalidateProjects(input.projectId);
  return res;
}

export async function listProjectDocumentsAction(projectId: string) {
  return listProjectDocuments(projectId);
}

export async function searchProjectDocumentsAction(
  query: string,
  projectId?: string
) {
  return searchProjectDocuments(query, projectId);
}

export async function listProjectDiscoveriesAction(projectId: string) {
  return listProjectDiscoveries(projectId);
}

export async function listProjectMemoriesAction(projectId: string) {
  return listProjectMemories(projectId);
}

export async function createBusinessAction(input: CreateBusinessInput) {
  const res = await createBusiness(input);
  revalidateProjects();
  return res;
}

export async function listBusinessesAction() {
  return listBusinesses();
}

export async function getBusinessAction(businessId: string) {
  return getBusiness(businessId);
}

export async function searchProjectsAction(query: string) {
  return searchProjectsAndBusiness(query);
}

export async function getHomeProjectsWidgetAction() {
  return getHomeProjectsWidget();
}

/**
 * RC4 Projects & Business OS — contracts.
 * No Decision Support / Execution. Does not alter Cognitive Kernel.
 * executionInfluence remains "none".
 */

export type ProjectStatus =
  | "idea"
  | "planning"
  | "active"
  | "paused"
  | "done"
  | "archived";

export type ProjectMemberRole = "owner" | "editor" | "viewer";

export type ProjectDocumentKind =
  | "pdf"
  | "image"
  | "audio"
  | "link"
  | "file";

export type BusinessSegment =
  | "saas"
  | "agency"
  | "ecommerce"
  | "consulting"
  | "content"
  | "other";

export type ProjectMember = {
  userId: string;
  role: ProjectMemberRole;
  addedAt: string;
  addedBy: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  workspaceId: string | null;
  ownerUserId: string;
  members: ProjectMember[];
  tags: string[];
  color: string;
  icon: string;
  favorite: boolean;
  archived: boolean;
  businessId: string | null;
  memoryIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  status?: ProjectStatus;
  workspaceId?: string | null;
  tags?: string[];
  color?: string;
  icon?: string;
  businessId?: string | null;
  favorite?: boolean;
};

export type UpdateProjectInput = {
  projectId: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string[];
  color?: string;
  icon?: string;
  favorite?: boolean;
  archived?: boolean;
  businessId?: string | null;
};

export type ProjectDocument = {
  id: string;
  projectId: string;
  userId: string;
  workspaceId: string | null;
  kind: ProjectDocumentKind;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  ocrText: string | null;
  searchableText: string;
  createdAt: string;
  updatedAt: string;
};

export type BusinessCompany = {
  id: string;
  name: string;
  segment: BusinessSegment;
  description: string;
  workspaceId: string | null;
  ownerUserId: string;
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateBusinessInput = {
  name: string;
  segment?: BusinessSegment;
  description?: string;
  workspaceId?: string | null;
};

export type ProjectTimelineKind =
  | "project_created"
  | "project_updated"
  | "status_changed"
  | "member_added"
  | "member_removed"
  | "memory_linked"
  | "memory_unlinked"
  | "document_added"
  | "comment"
  | "discovery"
  | "favorite";

export type ProjectTimelineEvent = {
  id: string;
  projectId: string;
  kind: ProjectTimelineKind;
  title: string;
  summary: string;
  actorUserId: string;
  href: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
};

export type ProjectsState = {
  projects: Project[];
  documents: ProjectDocument[];
  businesses: BusinessCompany[];
  timeline: ProjectTimelineEvent[];
};

export const PROJECT_STATUSES: ProjectStatus[] = [
  "idea",
  "planning",
  "active",
  "paused",
  "done",
  "archived",
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "Ideia",
  planning: "Planejamento",
  active: "Ativo",
  paused: "Pausado",
  done: "Concluído",
  archived: "Arquivado",
};

export const PROJECT_COLORS = [
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
  "#94a3b8",
] as const;

export function createEmptyProjectsState(): ProjectsState {
  return {
    projects: [],
    documents: [],
    businesses: [],
    timeline: [],
  };
}

export function newProjectId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function canEditProject(
  project: Project,
  userId: string
): boolean {
  if (project.ownerUserId === userId) return true;
  const member = project.members.find((m) => m.userId === userId);
  return member?.role === "owner" || member?.role === "editor";
}

export function canViewProject(
  project: Project,
  userId: string,
  opts?: { workspaceId?: string | null; isWorkspaceMember?: boolean }
): boolean {
  if (project.ownerUserId === userId) return true;
  if (project.members.some((m) => m.userId === userId)) return true;
  if (
    project.workspaceId &&
    opts?.workspaceId === project.workspaceId &&
    opts.isWorkspaceMember
  ) {
    return true;
  }
  return false;
}

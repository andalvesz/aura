/**
 * Project documents — attach PDF/image/audio/links/files, searchable.
 */

import {
  newProjectId,
  type ProjectDocument,
  type ProjectDocumentKind,
  type ProjectsState,
} from "@/lib/projects/types";
import { canEditProject } from "@/lib/projects/types";

function nowIso(): string {
  return new Date().toISOString();
}

function buildSearchable(input: {
  title: string;
  fileName: string;
  ocrText?: string | null;
}): string {
  return [input.title, input.fileName, input.ocrText ?? ""]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function addProjectDocumentPure(
  state: ProjectsState,
  input: {
    userId: string;
    projectId: string;
    kind: ProjectDocumentKind;
    title?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url?: string | null;
    ocrText?: string | null;
  }
): { state: ProjectsState; document: ProjectDocument | null; error: string | null } {
  const project = state.projects.find((p) => p.id === input.projectId);
  if (!project) return { state, document: null, error: "Projeto não encontrado" };
  if (!canEditProject(project, input.userId)) {
    return { state, document: null, error: "Sem permissão" };
  }

  const ts = nowIso();
  const title = (input.title ?? input.fileName).trim() || input.fileName;
  const document: ProjectDocument = {
    id: newProjectId("pdoc"),
    projectId: input.projectId,
    userId: input.userId,
    workspaceId: project.workspaceId,
    kind: input.kind,
    title,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    url: input.url ?? null,
    ocrText: input.ocrText ?? null,
    searchableText: buildSearchable({
      title,
      fileName: input.fileName,
      ocrText: input.ocrText,
    }),
    createdAt: ts,
    updatedAt: ts,
  };

  const next: ProjectsState = {
    ...state,
    documents: [document, ...state.documents],
    projects: state.projects.map((p) =>
      p.id === input.projectId ? { ...p, updatedAt: ts } : p
    ),
    timeline: [
      {
        id: newProjectId("ptl"),
        projectId: input.projectId,
        kind: "document_added" as const,
        title: `Documento: ${title}`,
        summary: String(input.kind),
        actorUserId: input.userId,
        href: `/dashboard/projects/${input.projectId}/documents`,
        relatedType: "document",
        relatedId: document.id,
        createdAt: ts,
      },
      ...state.timeline,
    ].slice(0, 500),
  };

  return { state: next, document, error: null };
}

export function listProjectDocumentsPure(
  state: ProjectsState,
  projectId: string,
  limit = 100
): ProjectDocument[] {
  return state.documents
    .filter((d) => d.projectId === projectId)
    .slice(0, limit);
}

export function searchProjectDocumentsPure(
  state: ProjectsState,
  query: string,
  opts?: { projectId?: string; limit?: number }
): ProjectDocument[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  let rows = state.documents;
  if (opts?.projectId) {
    rows = rows.filter((d) => d.projectId === opts.projectId);
  }
  return rows
    .filter(
      (d) =>
        d.searchableText.includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        (d.ocrText?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, opts?.limit ?? 30);
}

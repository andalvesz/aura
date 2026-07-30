/**
 * Search index + query for Knowledge Hub (OCR, notes, docs, links, comments, tags).
 */

import type {
  KnowledgeDocument,
  KnowledgeSearchHit,
  KnowledgeState,
} from "@/lib/knowledge/types";
import { canViewDocument } from "@/lib/knowledge/types";

export function buildDocumentSearchable(input: {
  title: string;
  description: string;
  content: string;
  summary: string;
  tags: string[];
  ocrText?: string | null;
  linkPreview?: {
    title?: string | null;
    description?: string | null;
    url?: string | null;
  } | null;
  fileName?: string | null;
  type: string;
}): string {
  return [
    input.title,
    input.description,
    input.content,
    input.summary,
    input.fileName ?? "",
    input.type,
    ...(input.tags ?? []),
    input.ocrText ?? "",
    input.linkPreview?.title ?? "",
    input.linkPreview?.description ?? "",
    input.linkPreview?.url ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function rebuildSearchIndex(state: KnowledgeState): KnowledgeState {
  const searchIndex: Record<string, string> = { ...state.searchIndex };
  for (const doc of state.documents) {
    const commentBlob = state.comments
      .filter((c) => c.documentId === doc.id && !c.deletedAt)
      .map((c) => c.body)
      .join(" ");
    searchIndex[doc.id] = `${doc.searchableText} ${commentBlob.toLowerCase()}`
      .replace(/\s+/g, " ")
      .trim();
  }
  return { ...state, searchIndex };
}

export function indexDocumentIncremental(
  state: KnowledgeState,
  documentId: string
): KnowledgeState {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) {
    const { [documentId]: _, ...rest } = state.searchIndex;
    return { ...state, searchIndex: rest };
  }
  const commentBlob = state.comments
    .filter((c) => c.documentId === documentId && !c.deletedAt)
    .map((c) => c.body)
    .join(" ");
  return {
    ...state,
    searchIndex: {
      ...state.searchIndex,
      [documentId]: `${doc.searchableText} ${commentBlob.toLowerCase()}`
        .replace(/\s+/g, " ")
        .trim(),
    },
    cache: { listUpdatedAt: new Date().toISOString() },
  };
}

function matchFields(
  doc: KnowledgeDocument,
  q: string,
  indexBlob: string
): string[] {
  const matched: string[] = [];
  if (doc.title.toLowerCase().includes(q)) matched.push("title");
  if (doc.description.toLowerCase().includes(q)) matched.push("description");
  if (doc.content.toLowerCase().includes(q)) matched.push("note");
  if (doc.ocrText?.toLowerCase().includes(q)) matched.push("ocr");
  if (doc.linkPreview?.title?.toLowerCase().includes(q)) matched.push("link");
  if (doc.linkPreview?.description?.toLowerCase().includes(q))
    matched.push("link");
  if (doc.tags.some((t) => t.toLowerCase().includes(q))) matched.push("tags");
  if (indexBlob.includes(q) && !matched.includes("comment")) {
    // comments live only in index blob beyond searchableText
    if (!doc.searchableText.includes(q) && indexBlob.includes(q)) {
      matched.push("comment");
    }
  }
  if (!matched.length && indexBlob.includes(q)) matched.push("content");
  return matched;
}

export function searchKnowledgePure(
  state: KnowledgeState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  query: string,
  opts?: {
    limit?: number;
    offset?: number;
    type?: KnowledgeDocument["type"];
    includeArchived?: boolean;
    collectionId?: string;
    projectId?: string;
    businessId?: string;
  }
): { hits: KnowledgeSearchHit[]; total: number } {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { hits: [], total: 0 };

  const limit = opts?.limit ?? 30;
  const offset = opts?.offset ?? 0;

  const scored: KnowledgeSearchHit[] = [];
  for (const doc of state.documents) {
    if (!canViewDocument(doc, viewer)) continue;
    if (doc.archived && !opts?.includeArchived) continue;
    if (opts?.type && doc.type !== opts.type) continue;
    if (opts?.projectId && doc.projectId !== opts.projectId) continue;
    if (opts?.businessId && doc.businessId !== opts.businessId) continue;
    if (
      opts?.collectionId &&
      !doc.collectionIds.includes(opts.collectionId)
    ) {
      continue;
    }

    const blob = state.searchIndex[doc.id] ?? doc.searchableText;
    if (!blob.includes(q) && !doc.title.toLowerCase().includes(q)) continue;

    const matchedIn = matchFields(doc, q, blob);
    let score = matchedIn.length;
    if (matchedIn.includes("title")) score += 3;
    if (matchedIn.includes("tags")) score += 2;
    if (matchedIn.includes("ocr")) score += 1;
    scored.push({ document: doc, score, matchedIn });
  }

  scored.sort((a, b) => b.score - a.score || b.document.updatedAt.localeCompare(a.document.updatedAt));
  return {
    total: scored.length,
    hits: scored.slice(offset, offset + limit),
  };
}

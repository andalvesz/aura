/**
 * RC4.1 Documents & Knowledge Hub — contracts.
 * Feeds Memory / World / Cognitive / Discovery without Decision Support or Execution.
 * Does not alter Cognitive Kernel. executionInfluence remains "none".
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import type { LinkPreview } from "@/lib/smart-capture/types";
import { EXECUTION_INFLUENCE_NONE } from "@/lib/aura-kernel/source-reference";

export const KNOWLEDGE_EXECUTION_INFLUENCE = EXECUTION_INFLUENCE_NONE;

export type KnowledgeDocumentType =
  | "note"
  | "pdf"
  | "image"
  | "link"
  | "file"
  | "audio"
  | "contract";

export type OcrStatus =
  | "none"
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "manual";

export type KnowledgeRelationType =
  | "project"
  | "business"
  | "memory"
  | "entity"
  | "discovery";

export type KnowledgeActivityKind =
  | "upload"
  | "edit"
  | "comment"
  | "ocr"
  | "version"
  | "restore"
  | "link"
  | "export"
  | "favorite"
  | "archive"
  | "collection";

export type KnowledgeCollectionKind = "collection" | "folder";

export type KnowledgeDocument = {
  id: string;
  title: string;
  description: string;
  type: KnowledgeDocumentType;
  workspaceId: string | null;
  projectId: string | null;
  businessId: string | null;
  tags: string[];
  authorUserId: string;
  visibility: VisibilityScope;
  /** Markdown body for notes; optional summary for others */
  content: string;
  summary: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  url: string | null;
  storagePath: string | null;
  linkPreview: LinkPreview | null;
  ocrText: string | null;
  ocrStatus: OcrStatus;
  ocrConfidence: number | null;
  searchableText: string;
  favorite: boolean;
  archived: boolean;
  collectionIds: string[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeVersion = {
  id: string;
  documentId: string;
  version: number;
  title: string;
  description: string;
  content: string;
  ocrText: string | null;
  authorUserId: string;
  createdAt: string;
  note: string;
};

export type KnowledgeRelation = {
  id: string;
  documentId: string;
  relationType: KnowledgeRelationType;
  targetId: string;
  label: string;
  createdBy: string;
  createdAt: string;
};

export type KnowledgeComment = {
  id: string;
  documentId: string;
  userId: string;
  workspaceId: string | null;
  parentId: string | null;
  body: string;
  visibility: VisibilityScope;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeCommentHistory = {
  id: string;
  commentId: string;
  userId: string;
  previousBody: string;
  createdAt: string;
};

export type KnowledgeCollection = {
  id: string;
  name: string;
  kind: KnowledgeCollectionKind;
  parentId: string | null;
  workspaceId: string | null;
  ownerUserId: string;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeActivity = {
  id: string;
  documentId: string | null;
  userId: string;
  workspaceId: string | null;
  kind: KnowledgeActivityKind;
  title: string;
  summary: string;
  href: string | null;
  createdAt: string;
};

export type KnowledgeState = {
  documents: KnowledgeDocument[];
  versions: KnowledgeVersion[];
  relations: KnowledgeRelation[];
  comments: KnowledgeComment[];
  commentHistory: KnowledgeCommentHistory[];
  collections: KnowledgeCollection[];
  activity: KnowledgeActivity[];
  /** Incremental search index: documentId → searchable blob */
  searchIndex: Record<string, string>;
  cache: {
    listUpdatedAt: string | null;
  };
};

export type CreateDocumentInput = {
  title: string;
  description?: string;
  type: KnowledgeDocumentType;
  workspaceId?: string | null;
  projectId?: string | null;
  businessId?: string | null;
  tags?: string[];
  visibility?: VisibilityScope;
  content?: string;
  summary?: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number;
  url?: string | null;
  storagePath?: string | null;
  linkPreview?: LinkPreview | null;
  ocrText?: string | null;
  ocrStatus?: OcrStatus;
  shareWithWorkspace?: boolean;
};

export type UpdateDocumentInput = {
  documentId: string;
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: VisibilityScope;
  content?: string;
  summary?: string;
  projectId?: string | null;
  businessId?: string | null;
  favorite?: boolean;
  archived?: boolean;
  url?: string | null;
  linkPreview?: LinkPreview | null;
  /** When true, skip creating a new version (autosave draft) */
  softSave?: boolean;
  versionNote?: string;
};

export type KnowledgeSearchHit = {
  document: KnowledgeDocument;
  score: number;
  matchedIn: string[];
};

export type KnowledgeExportFormat = "markdown" | "pdf" | "json";

export type KnowledgeHomeWidget = {
  recentDocuments: KnowledgeDocument[];
  recentNotes: KnowledgeDocument[];
  updatedKnowledge: KnowledgeDocument[];
};

export const DOCUMENT_TYPE_LABELS: Record<KnowledgeDocumentType, string> = {
  note: "Nota",
  pdf: "PDF",
  image: "Imagem",
  link: "Link",
  file: "Arquivo",
  audio: "Áudio",
  contract: "Contrato",
};

export const OCR_STATUS_LABELS: Record<OcrStatus, string> = {
  none: "Sem OCR",
  pending: "Pendente",
  processing: "Processando",
  ready: "Indexado",
  failed: "Falhou",
  manual: "Manual",
};

export function createEmptyKnowledgeState(): KnowledgeState {
  return {
    documents: [],
    versions: [],
    relations: [],
    comments: [],
    commentHistory: [],
    collections: [],
    activity: [],
    searchIndex: {},
    cache: { listUpdatedAt: null },
  };
}

export function newKnowledgeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function canViewDocument(
  doc: KnowledgeDocument,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): boolean {
  if (doc.authorUserId === viewer.userId) return true;
  if (doc.visibility === "PRIVATE") return false;
  if (doc.visibility === "SYSTEM_INTERNAL") return false;
  if (doc.visibility === "WORKSPACE") {
    return Boolean(
      viewer.isWorkspaceMember &&
        doc.workspaceId &&
        viewer.workspaceId === doc.workspaceId
    );
  }
  return false;
}

export function canEditDocument(
  doc: KnowledgeDocument,
  userId: string
): boolean {
  return doc.authorUserId === userId;
}

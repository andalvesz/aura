/**
 * Knowledge Hub pure engine — documents, notes, versions, OCR, relations,
 * collections, comments, activity. executionInfluence: none
 */

import {
  resolveCreateVisibility,
  type VisibilityScope,
} from "@/lib/aura-brain/visibility";
import { indexDocumentIncremental, buildDocumentSearchable } from "@/lib/knowledge/search";
import {
  canEditDocument,
  canViewDocument,
  newKnowledgeId,
  type CreateDocumentInput,
  type KnowledgeActivity,
  type KnowledgeActivityKind,
  type KnowledgeCollection,
  type KnowledgeCollectionKind,
  type KnowledgeComment,
  type KnowledgeDocument,
  type KnowledgeDocumentType,
  type KnowledgeHomeWidget,
  type KnowledgeRelation,
  type KnowledgeRelationType,
  type KnowledgeState,
  type KnowledgeVersion,
  type OcrStatus,
  type UpdateDocumentInput,
} from "@/lib/knowledge/types";

function nowIso(): string {
  return new Date().toISOString();
}

function pushActivity(
  state: KnowledgeState,
  input: {
    documentId: string | null;
    userId: string;
    workspaceId: string | null;
    kind: KnowledgeActivityKind;
    title: string;
    summary: string;
    href?: string | null;
  }
): KnowledgeState {
  const event: KnowledgeActivity = {
    id: newKnowledgeId("kact"),
    documentId: input.documentId,
    userId: input.userId,
    workspaceId: input.workspaceId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    href: input.href ?? null,
    createdAt: nowIso(),
  };
  return {
    ...state,
    activity: [event, ...state.activity].slice(0, 800),
  };
}

function snapshotVersion(
  doc: KnowledgeDocument,
  authorUserId: string,
  note: string
): KnowledgeVersion {
  return {
    id: newKnowledgeId("kver"),
    documentId: doc.id,
    version: doc.currentVersion,
    title: doc.title,
    description: doc.description,
    content: doc.content,
    ocrText: doc.ocrText,
    authorUserId,
    createdAt: nowIso(),
    note,
  };
}

function applySearchable(doc: KnowledgeDocument): KnowledgeDocument {
  return {
    ...doc,
    searchableText: buildDocumentSearchable({
      title: doc.title,
      description: doc.description,
      content: doc.content,
      summary: doc.summary,
      tags: doc.tags,
      ocrText: doc.ocrText,
      linkPreview: doc.linkPreview,
      fileName: doc.fileName,
      type: doc.type,
    }),
  };
}

export function createDocumentPure(
  state: KnowledgeState,
  authorUserId: string,
  input: CreateDocumentInput
): { state: KnowledgeState; document: KnowledgeDocument | null; error: string | null } {
  const title = input.title.trim();
  if (!title) return { state, document: null, error: "Título obrigatório" };

  const ts = nowIso();
  const visibility: VisibilityScope = resolveCreateVisibility({
    kind: "memory",
    explicit: input.visibility,
    shareWithWorkspace: input.shareWithWorkspace,
    workspaceId: input.workspaceId ?? null,
    activeContext: input.workspaceId ? "workspace" : "personal",
  });

  let ocrStatus: OcrStatus = input.ocrStatus ?? "none";
  if (
    !input.ocrStatus &&
    (input.type === "pdf" || input.type === "image" || input.type === "contract")
  ) {
    ocrStatus = input.ocrText ? "ready" : "pending";
  }

  let doc: KnowledgeDocument = {
    id: newKnowledgeId("kdoc"),
    title,
    description: (input.description ?? "").trim(),
    type: input.type,
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    businessId: input.businessId ?? null,
    tags: input.tags ?? [],
    authorUserId,
    visibility,
    content: input.content ?? "",
    summary: input.summary ?? "",
    fileName: input.fileName ?? null,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? 0,
    url: input.url ?? null,
    storagePath: input.storagePath ?? null,
    linkPreview: input.linkPreview ?? null,
    ocrText: input.ocrText ?? null,
    ocrStatus,
    ocrConfidence: input.ocrText ? 0.8 : null,
    searchableText: "",
    favorite: false,
    archived: false,
    collectionIds: [],
    currentVersion: 1,
    createdAt: ts,
    updatedAt: ts,
  };
  doc = applySearchable(doc);

  const version = snapshotVersion(doc, authorUserId, "versão inicial");
  let next: KnowledgeState = {
    ...state,
    documents: [doc, ...state.documents],
    versions: [version, ...state.versions],
  };
  next = indexDocumentIncremental(next, doc.id);
  next = pushActivity(next, {
    documentId: doc.id,
    userId: authorUserId,
    workspaceId: doc.workspaceId,
    kind: "upload",
    title: `Documento: ${doc.title}`,
    summary: doc.type,
    href: `/dashboard/knowledge/${doc.id}`,
  });

  return { state: next, document: doc, error: null };
}

export function updateDocumentPure(
  state: KnowledgeState,
  userId: string,
  input: UpdateDocumentInput
): { state: KnowledgeState; document: KnowledgeDocument | null; error: string | null } {
  const idx = state.documents.findIndex((d) => d.id === input.documentId);
  if (idx < 0) return { state, document: null, error: "Documento não encontrado" };
  const current = state.documents[idx];
  if (!canEditDocument(current, userId)) {
    return { state, document: null, error: "Sem permissão" };
  }

  const ts = nowIso();
  const soft = Boolean(input.softSave);
  const nextVersion = soft ? current.currentVersion : current.currentVersion + 1;

  let updated: KnowledgeDocument = applySearchable({
    ...current,
    title: input.title !== undefined ? input.title.trim() || current.title : current.title,
    description:
      input.description !== undefined ? input.description.trim() : current.description,
    tags: input.tags ?? current.tags,
    visibility: input.visibility ?? current.visibility,
    content: input.content !== undefined ? input.content : current.content,
    summary: input.summary !== undefined ? input.summary : current.summary,
    projectId:
      input.projectId !== undefined ? input.projectId : current.projectId,
    businessId:
      input.businessId !== undefined ? input.businessId : current.businessId,
    favorite: input.favorite ?? current.favorite,
    archived: input.archived ?? current.archived,
    url: input.url !== undefined ? input.url : current.url,
    linkPreview:
      input.linkPreview !== undefined ? input.linkPreview : current.linkPreview,
    currentVersion: nextVersion,
    updatedAt: ts,
  });

  let next: KnowledgeState = {
    ...state,
    documents: state.documents.map((d, i) => (i === idx ? updated : d)),
  };

  if (!soft) {
    const version = snapshotVersion(
      updated,
      userId,
      input.versionNote ?? "edição"
    );
    next = {
      ...next,
      versions: [version, ...next.versions],
    };
    next = pushActivity(next, {
      documentId: updated.id,
      userId,
      workspaceId: updated.workspaceId,
      kind: "version",
      title: `v${updated.currentVersion}: ${updated.title}`,
      summary: input.versionNote ?? "edição",
      href: `/dashboard/knowledge/${updated.id}`,
    });
  }

  next = indexDocumentIncremental(next, updated.id);
  return { state: next, document: updated, error: null };
}

export function getDocumentPure(
  state: KnowledgeState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  documentId: string
): KnowledgeDocument | null {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc || !canViewDocument(doc, viewer)) return null;
  return doc;
}

export function listDocumentsPure(
  state: KnowledgeState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  opts?: {
    limit?: number;
    offset?: number;
    type?: KnowledgeDocumentType;
    includeArchived?: boolean;
    favoriteOnly?: boolean;
    projectId?: string | null;
    businessId?: string | null;
    collectionId?: string;
    q?: string;
  }
): { items: KnowledgeDocument[]; total: number } {
  let rows = state.documents.filter((d) => canViewDocument(d, viewer));
  if (!opts?.includeArchived) rows = rows.filter((d) => !d.archived);
  if (opts?.favoriteOnly) rows = rows.filter((d) => d.favorite);
  if (opts?.type) rows = rows.filter((d) => d.type === opts.type);
  if (opts?.projectId) rows = rows.filter((d) => d.projectId === opts.projectId);
  if (opts?.businessId)
    rows = rows.filter((d) => d.businessId === opts.businessId);
  if (opts?.collectionId)
    rows = rows.filter((d) => d.collectionIds.includes(opts.collectionId!));
  if (opts?.q && opts.q.trim().length >= 2) {
    const q = opts.q.trim().toLowerCase();
    rows = rows.filter((d) => {
      const blob = state.searchIndex[d.id] ?? d.searchableText;
      return blob.includes(q) || d.title.toLowerCase().includes(q);
    });
  }
  rows = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const total = rows.length;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 40;
  return { items: rows.slice(offset, offset + limit), total };
}

export function applyOcrPure(
  state: KnowledgeState,
  userId: string,
  documentId: string,
  input: {
    ocrText: string;
    confidence?: number | null;
    status?: OcrStatus;
    reprocess?: boolean;
  }
): { state: KnowledgeState; document: KnowledgeDocument | null; error: string | null } {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) return { state, document: null, error: "Documento não encontrado" };
  if (!canEditDocument(doc, userId)) {
    return { state, document: null, error: "Sem permissão" };
  }

  const ts = nowIso();
  const nextVersion = doc.currentVersion + 1;
  let updated = applySearchable({
    ...doc,
    ocrText: input.ocrText,
    ocrStatus: input.status ?? (input.ocrText ? "ready" : "failed"),
    ocrConfidence: input.confidence ?? doc.ocrConfidence,
    currentVersion: nextVersion,
    updatedAt: ts,
    summary:
      doc.summary ||
      input.ocrText.slice(0, 280).replace(/\s+/g, " ").trim(),
  });

  const version = snapshotVersion(
    updated,
    userId,
    input.reprocess ? "OCR reprocessado" : "OCR indexado"
  );

  let next: KnowledgeState = {
    ...state,
    documents: state.documents.map((d) => (d.id === documentId ? updated : d)),
    versions: [version, ...state.versions],
  };
  next = indexDocumentIncremental(next, documentId);
  next = pushActivity(next, {
    documentId,
    userId,
    workspaceId: updated.workspaceId,
    kind: "ocr",
    title: `OCR: ${updated.title}`,
    summary: updated.ocrStatus,
    href: `/dashboard/knowledge/${documentId}`,
  });

  return { state: next, document: updated, error: null };
}

export function setOcrStatusPure(
  state: KnowledgeState,
  documentId: string,
  status: OcrStatus
): KnowledgeState {
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === documentId ? { ...d, ocrStatus: status, updatedAt: nowIso() } : d
    ),
  };
}

export function listVersionsPure(
  state: KnowledgeState,
  documentId: string
): KnowledgeVersion[] {
  return state.versions
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => b.version - a.version);
}

export function compareVersionsPure(
  state: KnowledgeState,
  documentId: string,
  versionA: number,
  versionB: number
): {
  a: KnowledgeVersion | null;
  b: KnowledgeVersion | null;
  diff: { field: string; from: string; to: string }[];
} {
  const versions = listVersionsPure(state, documentId);
  const a = versions.find((v) => v.version === versionA) ?? null;
  const b = versions.find((v) => v.version === versionB) ?? null;
  if (!a || !b) return { a, b, diff: [] };
  const fields: Array<keyof Pick<KnowledgeVersion, "title" | "description" | "content" | "ocrText">> =
    ["title", "description", "content", "ocrText"];
  const diff: { field: string; from: string; to: string }[] = [];
  for (const f of fields) {
    const from = String(a[f] ?? "");
    const to = String(b[f] ?? "");
    if (from !== to) diff.push({ field: f, from, to });
  }
  return { a, b, diff };
}

export function restoreVersionPure(
  state: KnowledgeState,
  userId: string,
  documentId: string,
  versionNumber: number
): { state: KnowledgeState; document: KnowledgeDocument | null; error: string | null } {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) return { state, document: null, error: "Documento não encontrado" };
  if (!canEditDocument(doc, userId)) {
    return { state, document: null, error: "Sem permissão" };
  }
  const snap = state.versions.find(
    (v) => v.documentId === documentId && v.version === versionNumber
  );
  if (!snap) return { state, document: null, error: "Versão não encontrada" };

  const ts = nowIso();
  let updated = applySearchable({
    ...doc,
    title: snap.title,
    description: snap.description,
    content: snap.content,
    ocrText: snap.ocrText,
    currentVersion: doc.currentVersion + 1,
    updatedAt: ts,
  });
  const version = snapshotVersion(
    updated,
    userId,
    `restaurado de v${versionNumber}`
  );
  let next: KnowledgeState = {
    ...state,
    documents: state.documents.map((d) => (d.id === documentId ? updated : d)),
    versions: [version, ...state.versions],
  };
  next = indexDocumentIncremental(next, documentId);
  next = pushActivity(next, {
    documentId,
    userId,
    workspaceId: updated.workspaceId,
    kind: "restore",
    title: `Restaurado v${versionNumber}: ${updated.title}`,
    summary: `→ v${updated.currentVersion}`,
    href: `/dashboard/knowledge/${documentId}`,
  });
  return { state: next, document: updated, error: null };
}

export function linkRelationPure(
  state: KnowledgeState,
  userId: string,
  input: {
    documentId: string;
    relationType: KnowledgeRelationType;
    targetId: string;
    label?: string;
  }
): { state: KnowledgeState; relation: KnowledgeRelation | null; error: string | null } {
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) return { state, relation: null, error: "Documento não encontrado" };
  if (!canEditDocument(doc, userId)) {
    return { state, relation: null, error: "Sem permissão" };
  }
  const exists = state.relations.find(
    (r) =>
      r.documentId === input.documentId &&
      r.relationType === input.relationType &&
      r.targetId === input.targetId
  );
  if (exists) return { state, relation: exists, error: null };

  const relation: KnowledgeRelation = {
    id: newKnowledgeId("krel"),
    documentId: input.documentId,
    relationType: input.relationType,
    targetId: input.targetId,
    label: input.label ?? `${input.relationType}:${input.targetId}`,
    createdBy: userId,
    createdAt: nowIso(),
  };

  let next: KnowledgeState = {
    ...state,
    relations: [relation, ...state.relations],
    documents: state.documents.map((d) => {
      if (d.id !== input.documentId) return d;
      if (input.relationType === "project") {
        return { ...d, projectId: input.targetId, updatedAt: nowIso() };
      }
      if (input.relationType === "business") {
        return { ...d, businessId: input.targetId, updatedAt: nowIso() };
      }
      return { ...d, updatedAt: nowIso() };
    }),
  };
  next = pushActivity(next, {
    documentId: input.documentId,
    userId,
    workspaceId: doc.workspaceId,
    kind: "link",
    title: `Vínculo ${input.relationType}`,
    summary: input.targetId,
    href: `/dashboard/knowledge/${input.documentId}`,
  });
  return { state: next, relation, error: null };
}

export function unlinkRelationPure(
  state: KnowledgeState,
  userId: string,
  relationId: string
): { state: KnowledgeState; error: string | null } {
  const rel = state.relations.find((r) => r.id === relationId);
  if (!rel) return { state, error: "Relação não encontrada" };
  const doc = state.documents.find((d) => d.id === rel.documentId);
  if (!doc || !canEditDocument(doc, userId)) {
    return { state, error: "Sem permissão" };
  }
  return {
    state: {
      ...state,
      relations: state.relations.filter((r) => r.id !== relationId),
    },
    error: null,
  };
}

export function listRelationsPure(
  state: KnowledgeState,
  documentId: string
): KnowledgeRelation[] {
  return state.relations.filter((r) => r.documentId === documentId);
}

export function addCommentPure(
  state: KnowledgeState,
  input: {
    userId: string;
    workspaceId?: string | null;
    documentId: string;
    body: string;
    parentId?: string | null;
    visibility?: VisibilityScope;
  }
): { state: KnowledgeState; comment: KnowledgeComment | null; error: string | null } {
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) return { state, comment: null, error: "Documento não encontrado" };
  if (
    !canViewDocument(doc, {
      userId: input.userId,
      workspaceId: input.workspaceId,
      isWorkspaceMember: Boolean(input.workspaceId),
    })
  ) {
    return { state, comment: null, error: "Sem permissão" };
  }
  const body = input.body.trim();
  if (!body) return { state, comment: null, error: "Comentário vazio" };
  if (input.parentId) {
    const parent = state.comments.find((c) => c.id === input.parentId);
    if (!parent || parent.documentId !== input.documentId) {
      return { state, comment: null, error: "Resposta inválida" };
    }
  }

  const ts = nowIso();
  const comment: KnowledgeComment = {
    id: newKnowledgeId("kcmt"),
    documentId: input.documentId,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    parentId: input.parentId ?? null,
    body,
    visibility: input.visibility ?? doc.visibility,
    editedAt: null,
    deletedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };

  let next: KnowledgeState = {
    ...state,
    comments: [comment, ...state.comments],
  };
  next = indexDocumentIncremental(next, input.documentId);
  next = pushActivity(next, {
    documentId: input.documentId,
    userId: input.userId,
    workspaceId: doc.workspaceId,
    kind: "comment",
    title: `Comentário em ${doc.title}`,
    summary: body.slice(0, 120),
    href: `/dashboard/knowledge/${input.documentId}`,
  });
  return { state: next, comment, error: null };
}

export function editCommentPure(
  state: KnowledgeState,
  input: { userId: string; commentId: string; body: string }
): { state: KnowledgeState; comment: KnowledgeComment | null; error: string | null } {
  const comment = state.comments.find((c) => c.id === input.commentId);
  if (!comment || comment.deletedAt) {
    return { state, comment: null, error: "Comentário não encontrado" };
  }
  if (comment.userId !== input.userId) {
    return { state, comment: null, error: "Sem permissão" };
  }
  const ts = nowIso();
  const updated: KnowledgeComment = {
    ...comment,
    body: input.body.trim(),
    editedAt: ts,
    updatedAt: ts,
  };
  let next: KnowledgeState = {
    ...state,
    comments: state.comments.map((c) => (c.id === comment.id ? updated : c)),
    commentHistory: [
      {
        id: newKnowledgeId("kcmh"),
        commentId: comment.id,
        userId: input.userId,
        previousBody: comment.body,
        createdAt: ts,
      },
      ...state.commentHistory,
    ],
  };
  next = indexDocumentIncremental(next, comment.documentId);
  return { state: next, comment: updated, error: null };
}

export function deleteCommentPure(
  state: KnowledgeState,
  input: { userId: string; commentId: string }
): { state: KnowledgeState; comment: KnowledgeComment | null; error: string | null } {
  const comment = state.comments.find((c) => c.id === input.commentId);
  if (!comment || comment.deletedAt) {
    return { state, comment: null, error: "Comentário não encontrado" };
  }
  if (comment.userId !== input.userId) {
    return { state, comment: null, error: "Sem permissão" };
  }
  const ts = nowIso();
  const updated: KnowledgeComment = {
    ...comment,
    deletedAt: ts,
    updatedAt: ts,
    body: "",
  };
  let next: KnowledgeState = {
    ...state,
    comments: state.comments.map((c) => (c.id === comment.id ? updated : c)),
    commentHistory: [
      {
        id: newKnowledgeId("kcmh"),
        commentId: comment.id,
        userId: input.userId,
        previousBody: comment.body,
        createdAt: ts,
      },
      ...state.commentHistory,
    ],
  };
  next = indexDocumentIncremental(next, comment.documentId);
  return { state: next, comment: updated, error: null };
}

export function listCommentsPure(
  state: KnowledgeState,
  documentId: string
): KnowledgeComment[] {
  return state.comments
    .filter((c) => c.documentId === documentId && !c.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createCollectionPure(
  state: KnowledgeState,
  input: {
    userId: string;
    workspaceId?: string | null;
    name: string;
    kind?: KnowledgeCollectionKind;
    parentId?: string | null;
  }
): { state: KnowledgeState; collection: KnowledgeCollection | null; error: string | null } {
  const name = input.name.trim();
  if (!name) return { state, collection: null, error: "Nome obrigatório" };
  const ts = nowIso();
  const collection: KnowledgeCollection = {
    id: newKnowledgeId("kcol"),
    name,
    kind: input.kind ?? "collection",
    parentId: input.parentId ?? null,
    workspaceId: input.workspaceId ?? null,
    ownerUserId: input.userId,
    documentIds: [],
    createdAt: ts,
    updatedAt: ts,
  };
  return {
    state: {
      ...state,
      collections: [collection, ...state.collections],
    },
    collection,
    error: null,
  };
}

export function addToCollectionPure(
  state: KnowledgeState,
  userId: string,
  collectionId: string,
  documentId: string
): { state: KnowledgeState; error: string | null } {
  const col = state.collections.find((c) => c.id === collectionId);
  if (!col) return { state, error: "Coleção não encontrada" };
  if (col.ownerUserId !== userId) return { state, error: "Sem permissão" };
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc || !canEditDocument(doc, userId)) {
    return { state, error: "Documento inválido" };
  }
  if (col.documentIds.includes(documentId)) return { state, error: null };

  const collections = state.collections.map((c) =>
    c.id === collectionId
      ? {
          ...c,
          documentIds: [documentId, ...c.documentIds],
          updatedAt: nowIso(),
        }
      : c
  );
  const documents = state.documents.map((d) =>
    d.id === documentId
      ? {
          ...d,
          collectionIds: d.collectionIds.includes(collectionId)
            ? d.collectionIds
            : [...d.collectionIds, collectionId],
          updatedAt: nowIso(),
        }
      : d
  );
  let next: KnowledgeState = { ...state, collections, documents };
  next = pushActivity(next, {
    documentId,
    userId,
    workspaceId: doc.workspaceId,
    kind: "collection",
    title: `Coleção: ${col.name}`,
    summary: doc.title,
    href: `/dashboard/knowledge/${documentId}`,
  });
  return { state: next, error: null };
}

export function listCollectionsPure(
  state: KnowledgeState,
  userId: string
): KnowledgeCollection[] {
  return state.collections.filter((c) => c.ownerUserId === userId);
}

export function listActivityPure(
  state: KnowledgeState,
  opts?: { documentId?: string; limit?: number }
): KnowledgeActivity[] {
  let rows = state.activity;
  if (opts?.documentId) {
    rows = rows.filter((a) => a.documentId === opts.documentId);
  }
  return rows.slice(0, opts?.limit ?? 50);
}

export function getHomeKnowledgeWidgetPure(
  state: KnowledgeState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): KnowledgeHomeWidget {
  const visible = state.documents
    .filter((d) => canViewDocument(d, viewer) && !d.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    recentDocuments: visible.filter((d) => d.type !== "note").slice(0, 5),
    recentNotes: visible.filter((d) => d.type === "note").slice(0, 5),
    updatedKnowledge: visible.slice(0, 5),
  };
}

export function listDocumentsForProjectPure(
  state: KnowledgeState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  projectId: string
): KnowledgeDocument[] {
  return listDocumentsPure(state, viewer, {
    projectId,
    limit: 100,
    includeArchived: false,
  }).items;
}

export function listDocumentsForBusinessPure(
  state: KnowledgeState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  businessId: string,
  opts?: { contractsOnly?: boolean }
): KnowledgeDocument[] {
  const { items } = listDocumentsPure(state, viewer, {
    businessId,
    limit: 100,
  });
  if (opts?.contractsOnly) {
    return items.filter(
      (d) => d.type === "contract" || d.tags.includes("contrato")
    );
  }
  return items;
}

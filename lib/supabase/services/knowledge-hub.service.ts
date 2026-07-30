/**
 * Knowledge Hub service facade (RC4.1).
 * executionInfluence: "none"
 */

import {
  addCommentPure,
  addToCollectionPure,
  applyOcrPure,
  compareVersionsPure,
  createCollectionPure,
  createDocumentPure,
  deleteCommentPure,
  editCommentPure,
  exportDocumentPure,
  getDocumentPure,
  getHomeKnowledgeWidgetPure,
  getKnowledgeState,
  knowledgeStoreKey,
  linkRelationPure,
  listActivityPure,
  listCollectionsPure,
  listCommentsPure,
  listDocumentsForBusinessPure,
  listDocumentsForProjectPure,
  listDocumentsPure,
  listRelationsPure,
  listVersionsPure,
  restoreVersionPure,
  searchKnowledgePure,
  setKnowledgeState,
  setOcrStatusPure,
  unlinkRelationPure,
  updateDocumentPure,
  type CreateDocumentInput,
  type KnowledgeCollection,
  type KnowledgeComment,
  type KnowledgeDocument,
  type KnowledgeExportFormat,
  type KnowledgeHomeWidget,
  type KnowledgeRelation,
  type KnowledgeRelationType,
  type KnowledgeSearchHit,
  type KnowledgeVersion,
  type OcrStatus,
  type UpdateDocumentInput,
} from "@/lib/knowledge";
import { getDataContext } from "@/lib/supabase/services/context";
import { fetchLinkPreview } from "@/lib/smart-capture/link-preview";

function keyFromCtx(userId: string, workspaceId: string | null): string {
  return knowledgeStoreKey(userId, workspaceId);
}

async function ctxKey() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  return {
    ctx,
    ws,
    key: keyFromCtx(ctx.userId, ws),
    viewer: {
      userId: ctx.userId,
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

export async function createKnowledgeDocument(
  input: CreateDocumentInput
): Promise<{ document: KnowledgeDocument | null; error: string | null }> {
  const { ctx, ws, key } = await ctxKey();
  const res = createDocumentPure(getKnowledgeState(key), ctx.userId, {
    ...input,
    workspaceId: input.workspaceId !== undefined ? input.workspaceId : ws,
  });
  if (res.error) return { document: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { document: res.document, error: null };
}

export async function updateKnowledgeDocument(
  input: UpdateDocumentInput
): Promise<{ document: KnowledgeDocument | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = updateDocumentPure(getKnowledgeState(key), ctx.userId, input);
  if (res.error) return { document: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { document: res.document, error: null };
}

export async function getKnowledgeDocument(
  documentId: string
): Promise<KnowledgeDocument | null> {
  const { key, viewer } = await ctxKey();
  return getDocumentPure(getKnowledgeState(key), viewer, documentId);
}

export async function listKnowledgeDocuments(opts?: {
  limit?: number;
  offset?: number;
  type?: KnowledgeDocument["type"];
  includeArchived?: boolean;
  favoriteOnly?: boolean;
  projectId?: string | null;
  businessId?: string | null;
  collectionId?: string;
  q?: string;
}): Promise<{ items: KnowledgeDocument[]; total: number }> {
  const { key, viewer } = await ctxKey();
  return listDocumentsPure(getKnowledgeState(key), viewer, opts);
}

export async function searchKnowledge(
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
): Promise<{ hits: KnowledgeSearchHit[]; total: number }> {
  const { key, viewer } = await ctxKey();
  return searchKnowledgePure(getKnowledgeState(key), viewer, query, opts);
}

export async function applyKnowledgeOcr(
  documentId: string,
  input: {
    ocrText: string;
    confidence?: number | null;
    status?: OcrStatus;
    reprocess?: boolean;
  }
): Promise<{ document: KnowledgeDocument | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  let state = getKnowledgeState(key);
  state = setOcrStatusPure(state, documentId, "processing");
  setKnowledgeState(key, state);
  const res = applyOcrPure(state, ctx.userId, documentId, input);
  if (res.error) return { document: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { document: res.document, error: null };
}

export async function createLinkDocument(input: {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  projectId?: string | null;
  businessId?: string | null;
  shareWithWorkspace?: boolean;
}): Promise<{ document: KnowledgeDocument | null; error: string | null }> {
  const preview =
    (await fetchLinkPreview(input.url)) ??
    ({
      url: input.url,
      title: input.title?.trim() || input.url,
      description: input.description ?? null,
      favicon: null,
      image: null,
      fetchedAt: new Date().toISOString(),
    } as const);
  return createKnowledgeDocument({
    title: input.title?.trim() || preview.title || input.url,
    description: input.description ?? preview.description ?? "",
    type: "link",
    url: input.url,
    linkPreview: preview,
    tags: input.tags,
    projectId: input.projectId,
    businessId: input.businessId,
    shareWithWorkspace: input.shareWithWorkspace,
    summary: preview.description?.slice(0, 280) ?? "",
  });
}

export async function createNoteDocument(input: {
  title: string;
  content?: string;
  tags?: string[];
  projectId?: string | null;
  businessId?: string | null;
  shareWithWorkspace?: boolean;
}): Promise<{ document: KnowledgeDocument | null; error: string | null }> {
  return createKnowledgeDocument({
    title: input.title,
    type: "note",
    content: input.content ?? "",
    tags: input.tags,
    projectId: input.projectId,
    businessId: input.businessId,
    shareWithWorkspace: input.shareWithWorkspace,
    summary: (input.content ?? "").slice(0, 280),
  });
}

export async function listKnowledgeVersions(
  documentId: string
): Promise<KnowledgeVersion[]> {
  const { key } = await ctxKey();
  return listVersionsPure(getKnowledgeState(key), documentId);
}

export async function compareKnowledgeVersions(
  documentId: string,
  versionA: number,
  versionB: number
) {
  const { key } = await ctxKey();
  return compareVersionsPure(
    getKnowledgeState(key),
    documentId,
    versionA,
    versionB
  );
}

export async function restoreKnowledgeVersion(
  documentId: string,
  versionNumber: number
): Promise<{ document: KnowledgeDocument | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = restoreVersionPure(
    getKnowledgeState(key),
    ctx.userId,
    documentId,
    versionNumber
  );
  if (res.error) return { document: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { document: res.document, error: null };
}

export async function linkKnowledgeRelation(input: {
  documentId: string;
  relationType: KnowledgeRelationType;
  targetId: string;
  label?: string;
}): Promise<{ relation: KnowledgeRelation | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = linkRelationPure(getKnowledgeState(key), ctx.userId, input);
  if (res.error) return { relation: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { relation: res.relation, error: null };
}

export async function unlinkKnowledgeRelation(
  relationId: string
): Promise<{ error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = unlinkRelationPure(getKnowledgeState(key), ctx.userId, relationId);
  if (res.error) return { error: res.error };
  setKnowledgeState(key, res.state);
  return { error: null };
}

export async function listKnowledgeRelations(
  documentId: string
): Promise<KnowledgeRelation[]> {
  const { key } = await ctxKey();
  return listRelationsPure(getKnowledgeState(key), documentId);
}

export async function addKnowledgeComment(input: {
  documentId: string;
  body: string;
  parentId?: string | null;
}): Promise<{ comment: KnowledgeComment | null; error: string | null }> {
  const { ctx, ws, key } = await ctxKey();
  const res = addCommentPure(getKnowledgeState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    documentId: input.documentId,
    body: input.body,
    parentId: input.parentId,
  });
  if (res.error) return { comment: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { comment: res.comment, error: null };
}

export async function editKnowledgeComment(input: {
  commentId: string;
  body: string;
}): Promise<{ comment: KnowledgeComment | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = editCommentPure(getKnowledgeState(key), {
    userId: ctx.userId,
    commentId: input.commentId,
    body: input.body,
  });
  if (res.error) return { comment: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { comment: res.comment, error: null };
}

export async function deleteKnowledgeComment(
  commentId: string
): Promise<{ comment: KnowledgeComment | null; error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = deleteCommentPure(getKnowledgeState(key), {
    userId: ctx.userId,
    commentId,
  });
  if (res.error) return { comment: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { comment: res.comment, error: null };
}

export async function listKnowledgeComments(
  documentId: string
): Promise<KnowledgeComment[]> {
  const { key } = await ctxKey();
  return listCommentsPure(getKnowledgeState(key), documentId);
}

export async function createKnowledgeCollection(input: {
  name: string;
  kind?: "collection" | "folder";
  parentId?: string | null;
}): Promise<{ collection: KnowledgeCollection | null; error: string | null }> {
  const { ctx, ws, key } = await ctxKey();
  const res = createCollectionPure(getKnowledgeState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    name: input.name,
    kind: input.kind,
    parentId: input.parentId,
  });
  if (res.error) return { collection: null, error: res.error };
  setKnowledgeState(key, res.state);
  return { collection: res.collection, error: null };
}

export async function addDocumentToCollection(
  collectionId: string,
  documentId: string
): Promise<{ error: string | null }> {
  const { ctx, key } = await ctxKey();
  const res = addToCollectionPure(
    getKnowledgeState(key),
    ctx.userId,
    collectionId,
    documentId
  );
  if (res.error) return { error: res.error };
  setKnowledgeState(key, res.state);
  return { error: null };
}

export async function listKnowledgeCollections(): Promise<KnowledgeCollection[]> {
  const { ctx, key } = await ctxKey();
  return listCollectionsPure(getKnowledgeState(key), ctx.userId);
}

export async function listKnowledgeActivity(opts?: {
  documentId?: string;
  limit?: number;
}) {
  const { key } = await ctxKey();
  return listActivityPure(getKnowledgeState(key), opts);
}

export async function exportKnowledgeDocument(
  documentId: string,
  format: KnowledgeExportFormat
) {
  const { key, viewer } = await ctxKey();
  const state = getKnowledgeState(key);
  const doc = getDocumentPure(state, viewer, documentId);
  if (!doc) return { payload: null, error: "Documento não encontrado" };
  return { payload: exportDocumentPure(state, documentId, format), error: null };
}

export async function getHomeKnowledgeWidget(): Promise<KnowledgeHomeWidget> {
  const { key, viewer } = await ctxKey();
  return getHomeKnowledgeWidgetPure(getKnowledgeState(key), viewer);
}

export async function listProjectKnowledgeDocuments(
  projectId: string
): Promise<KnowledgeDocument[]> {
  const { key, viewer } = await ctxKey();
  return listDocumentsForProjectPure(getKnowledgeState(key), viewer, projectId);
}

export async function listBusinessKnowledgeDocuments(
  businessId: string,
  opts?: { contractsOnly?: boolean }
): Promise<KnowledgeDocument[]> {
  const { key, viewer } = await ctxKey();
  return listDocumentsForBusinessPure(
    getKnowledgeState(key),
    viewer,
    businessId,
    opts
  );
}

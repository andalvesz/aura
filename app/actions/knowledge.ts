"use server";

import { revalidatePath } from "next/cache";
import {
  addDocumentToCollection,
  addKnowledgeComment,
  applyKnowledgeOcr,
  compareKnowledgeVersions,
  createKnowledgeCollection,
  createKnowledgeDocument,
  createLinkDocument,
  createNoteDocument,
  deleteKnowledgeComment,
  editKnowledgeComment,
  exportKnowledgeDocument,
  getHomeKnowledgeWidget,
  getKnowledgeDocument,
  linkKnowledgeRelation,
  listBusinessKnowledgeDocuments,
  listKnowledgeActivity,
  listKnowledgeCollections,
  listKnowledgeComments,
  listKnowledgeDocuments,
  listKnowledgeRelations,
  listKnowledgeVersions,
  listProjectKnowledgeDocuments,
  restoreKnowledgeVersion,
  searchKnowledge,
  unlinkKnowledgeRelation,
  updateKnowledgeDocument,
} from "@/lib/supabase/services/knowledge-hub.service";
import type {
  CreateDocumentInput,
  KnowledgeDocumentType,
  KnowledgeExportFormat,
  KnowledgeRelationType,
  OcrStatus,
  UpdateDocumentInput,
} from "@/lib/knowledge/types";

function revalidateKnowledge(documentId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/knowledge");
  revalidatePath("/dashboard/business");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/attachments");
  if (documentId) {
    revalidatePath(`/dashboard/knowledge/${documentId}`);
  }
}

export async function createKnowledgeDocumentAction(input: CreateDocumentInput) {
  const res = await createKnowledgeDocument(input);
  revalidateKnowledge(res.document?.id);
  return res;
}

export async function createNoteAction(input: {
  title: string;
  content?: string;
  tags?: string[];
  projectId?: string | null;
  businessId?: string | null;
  shareWithWorkspace?: boolean;
}) {
  const res = await createNoteDocument(input);
  revalidateKnowledge(res.document?.id);
  return res;
}

export async function createLinkAction(input: {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  projectId?: string | null;
  businessId?: string | null;
  shareWithWorkspace?: boolean;
}) {
  const res = await createLinkDocument(input);
  revalidateKnowledge(res.document?.id);
  return res;
}

export async function updateKnowledgeDocumentAction(input: UpdateDocumentInput) {
  const res = await updateKnowledgeDocument(input);
  revalidateKnowledge(input.documentId);
  return res;
}

export async function autosaveNoteAction(input: {
  documentId: string;
  title?: string;
  content: string;
}) {
  return updateKnowledgeDocumentAction({
    documentId: input.documentId,
    title: input.title,
    content: input.content,
    summary: input.content.slice(0, 280),
    softSave: true,
  });
}

export async function getKnowledgeDocumentAction(documentId: string) {
  return getKnowledgeDocument(documentId);
}

export async function listKnowledgeDocumentsAction(opts?: {
  limit?: number;
  offset?: number;
  type?: KnowledgeDocumentType;
  includeArchived?: boolean;
  favoriteOnly?: boolean;
  projectId?: string | null;
  businessId?: string | null;
  collectionId?: string;
  q?: string;
}) {
  return listKnowledgeDocuments(opts);
}

export async function searchKnowledgeAction(
  query: string,
  opts?: {
    limit?: number;
    offset?: number;
    type?: KnowledgeDocumentType;
    projectId?: string;
    businessId?: string;
    collectionId?: string;
  }
) {
  return searchKnowledge(query, opts);
}

export async function applyKnowledgeOcrAction(
  documentId: string,
  input: {
    ocrText: string;
    confidence?: number | null;
    status?: OcrStatus;
    reprocess?: boolean;
  }
) {
  const res = await applyKnowledgeOcr(documentId, input);
  revalidateKnowledge(documentId);
  return res;
}

export async function listKnowledgeVersionsAction(documentId: string) {
  return listKnowledgeVersions(documentId);
}

export async function compareKnowledgeVersionsAction(
  documentId: string,
  versionA: number,
  versionB: number
) {
  return compareKnowledgeVersions(documentId, versionA, versionB);
}

export async function restoreKnowledgeVersionAction(
  documentId: string,
  versionNumber: number
) {
  const res = await restoreKnowledgeVersion(documentId, versionNumber);
  revalidateKnowledge(documentId);
  return res;
}

export async function linkKnowledgeRelationAction(input: {
  documentId: string;
  relationType: KnowledgeRelationType;
  targetId: string;
  label?: string;
}) {
  const res = await linkKnowledgeRelation(input);
  revalidateKnowledge(input.documentId);
  return res;
}

export async function unlinkKnowledgeRelationAction(relationId: string) {
  return unlinkKnowledgeRelation(relationId);
}

export async function listKnowledgeRelationsAction(documentId: string) {
  return listKnowledgeRelations(documentId);
}

export async function addKnowledgeCommentAction(input: {
  documentId: string;
  body: string;
  parentId?: string | null;
}) {
  const res = await addKnowledgeComment(input);
  revalidateKnowledge(input.documentId);
  return res;
}

export async function editKnowledgeCommentAction(input: {
  commentId: string;
  body: string;
  documentId: string;
}) {
  const res = await editKnowledgeComment(input);
  revalidateKnowledge(input.documentId);
  return res;
}

export async function deleteKnowledgeCommentAction(input: {
  commentId: string;
  documentId: string;
}) {
  const res = await deleteKnowledgeComment(input.commentId);
  revalidateKnowledge(input.documentId);
  return res;
}

export async function listKnowledgeCommentsAction(documentId: string) {
  return listKnowledgeComments(documentId);
}

export async function createKnowledgeCollectionAction(input: {
  name: string;
  kind?: "collection" | "folder";
  parentId?: string | null;
}) {
  const res = await createKnowledgeCollection(input);
  revalidateKnowledge();
  return res;
}

export async function addDocumentToCollectionAction(
  collectionId: string,
  documentId: string
) {
  const res = await addDocumentToCollection(collectionId, documentId);
  revalidateKnowledge(documentId);
  return res;
}

export async function listKnowledgeCollectionsAction() {
  return listKnowledgeCollections();
}

export async function listKnowledgeActivityAction(opts?: {
  documentId?: string;
  limit?: number;
}) {
  return listKnowledgeActivity(opts);
}

export async function exportKnowledgeDocumentAction(
  documentId: string,
  format: KnowledgeExportFormat
) {
  return exportKnowledgeDocument(documentId, format);
}

export async function getHomeKnowledgeWidgetAction() {
  return getHomeKnowledgeWidget();
}

export async function listProjectKnowledgeDocumentsAction(projectId: string) {
  return listProjectKnowledgeDocuments(projectId);
}

export async function listBusinessKnowledgeDocumentsAction(
  businessId: string,
  opts?: { contractsOnly?: boolean }
) {
  return listBusinessKnowledgeDocuments(businessId, opts);
}

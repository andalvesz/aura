/**
 * RC4.1 Knowledge Hub — public API.
 * executionInfluence: "none"
 */

export * from "@/lib/knowledge/types";
export * from "@/lib/knowledge/store";
export {
  createDocumentPure,
  updateDocumentPure,
  getDocumentPure,
  listDocumentsPure,
  applyOcrPure,
  setOcrStatusPure,
  listVersionsPure,
  compareVersionsPure,
  restoreVersionPure,
  linkRelationPure,
  unlinkRelationPure,
  listRelationsPure,
  addCommentPure,
  editCommentPure,
  deleteCommentPure,
  listCommentsPure,
  createCollectionPure,
  addToCollectionPure,
  listCollectionsPure,
  listActivityPure,
  getHomeKnowledgeWidgetPure,
  listDocumentsForProjectPure,
  listDocumentsForBusinessPure,
} from "@/lib/knowledge/engine";
export {
  searchKnowledgePure,
  buildDocumentSearchable,
  rebuildSearchIndex,
  indexDocumentIncremental,
} from "@/lib/knowledge/search";
export {
  exportDocumentPure,
  documentToMarkdownPreview,
  type KnowledgeExportPayload,
} from "@/lib/knowledge/export";

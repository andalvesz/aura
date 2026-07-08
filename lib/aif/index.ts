export { runAifImportPipeline, flattenParsedCourse, AIF_SUPPORTED_EXTENSIONS } from "./import-pipeline";
export type { AifImportPipelineOptions } from "./import-pipeline";

export { runAifKnowledgeExtractor, extractionDraftToStructured } from "./knowledge-extractor";
export type { AifExtractionInput, AifExtractionDraft } from "./knowledge-extractor";

export {
  runAifKnowledgeNormalizer,
  structuredKnowledgeFingerprint,
  mergeNormalizedKnowledge,
} from "./knowledge-normalizer";

export {
  runAifKnowledgeValidator,
  boostConfidenceAfterValidation,
  attachValidationToKnowledge,
} from "./knowledge-validator";

export { buildAifKnowledgeGraph, buildAifFunnelChainNodes, summarizeAifGraph } from "./knowledge-graph";

export {
  ensureAifOperationalDecisionRules,
  formatDecisionRulesForExpertBrain,
  isOperationalDecisionRule,
  filterOperationalRules,
} from "./decision-rules";

export {
  splitTextIntoChunks,
  createChunkId,
  logAifChunkPlan,
  AIF_MAX_CHUNK_CHARS,
  AIF_HARD_MAX_EXTRACT_CHARS,
} from "./chunking";

export {
  getProgress,
  buildAifV2MetadataPatch,
  aifChunkProgressPercent,
  allChunksCompleted,
  isAifChunkStatus,
  AIF_VERSION_V2,
  AIF_CHUNK_STATUSES,
} from "./aif-progress";
export type { AifProgressSnapshot, AifV2QueueMetadata } from "./aif-progress";

// updateProgress is server-only — import from "@/lib/aif/aif-progress-update"

export {
  emptyExtractionDraft,
  mergeChunkResults,
  finalizeChunkKnowledge,
  commitChunkKnowledge,
} from "./aif-commit";

// runAifPipelineStep lives in aif-pipeline-step.ts — import it directly to avoid
// circular dependency with aif.service.ts (which imports this barrel).

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

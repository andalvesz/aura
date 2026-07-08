import { runAifKnowledgeNormalizer } from "@/lib/aif/knowledge-normalizer";
import { mergeNormalizedKnowledge } from "@/lib/aif/knowledge-normalizer";
import type { AifExtractionDraft } from "@/lib/aif/knowledge-extractor";
import { runAifKnowledgeValidator, boostConfidenceAfterValidation, attachValidationToKnowledge } from "@/lib/aif/knowledge-validator";
import { ensureAifOperationalDecisionRules } from "@/lib/aif/decision-rules";
import { buildAifKnowledgeGraph } from "@/lib/aif/knowledge-graph";
import type { AifStructuredKnowledge } from "@/utils/aif";

export function emptyExtractionDraft(): AifExtractionDraft {
  return {
    frameworks: [],
    checklists: [],
    decisionRules: [],
    kpis: [],
    cases: [],
    principles: [],
    mentalModels: [],
    antiPatterns: [],
    concepts: [],
  };
}

export function mergeChunkResults(
  accumulated: AifExtractionDraft,
  incoming: AifExtractionDraft
): AifExtractionDraft {
  return mergeNormalizedKnowledge(accumulated, incoming);
}

export function finalizeChunkKnowledge(
  draft: AifExtractionDraft,
  niche?: string | null
): AifStructuredKnowledge {
  const normalized = runAifKnowledgeNormalizer(draft, niche);
  const withRules = ensureAifOperationalDecisionRules(normalized);
  const { draft: validated, report } = runAifKnowledgeValidator(withRules);
  const boosted = boostConfidenceAfterValidation(validated, report);
  const graph = buildAifKnowledgeGraph(boosted);
  return attachValidationToKnowledge(boosted, graph, report);
}

/** Incremental commit entry — DB write lives in aif.service to avoid cycles. */
export async function commitChunkKnowledge(params: {
  commit: () => Promise<{ sourceId: string | null; entityCount: number; error: string | null }>;
}): Promise<{ sourceId: string | null; entityCount: number; error: string | null }> {
  return params.commit();
}

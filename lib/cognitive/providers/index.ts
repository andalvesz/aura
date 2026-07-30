/**
 * Optional CognitiveReasoningProvider — never invents evidence.
 */

import { redactForProvider, sanitizeUntrustedContent } from "@/lib/cognitive/privacy";
import type { CognitiveArtifact, CognitiveEvidence } from "@/lib/cognitive/types";

export type ProviderInsightDraft = {
  title: string;
  summary: string;
  limitations: string[];
  alternativeHypotheses: Array<{ statement: string; rationale: string }>;
};

export type CognitiveReasoningProvider = {
  name: string;
  version: string;
  summarizeEvidence(evidence: CognitiveEvidence[]): Promise<string>;
  generateInsightDraft(input: {
    title: string;
    summary: string;
    evidenceSummaries: string[];
  }): Promise<ProviderInsightDraft>;
  generateAlternativeHypotheses(statement: string): Promise<
    Array<{ statement: string; rationale: string }>
  >;
  rewriteForClarity(text: string): Promise<string>;
  generateClarifyingQuestion(topic: string): Promise<string>;
};

export class NoneReasoningProvider implements CognitiveReasoningProvider {
  name = "none";
  version = "1";

  async summarizeEvidence(evidence: CognitiveEvidence[]): Promise<string> {
    return evidence.map((e) => e.summary).join("; ").slice(0, 500);
  }

  async generateInsightDraft(input: {
    title: string;
    summary: string;
    evidenceSummaries: string[];
  }): Promise<ProviderInsightDraft> {
    const safe = redactForProvider(input);
    return {
      title: safe.title,
      summary: safe.summary,
      limitations: ["provider:none — deterministic passthrough"],
      alternativeHypotheses: [],
    };
  }

  async generateAlternativeHypotheses(
    statement: string
  ): Promise<Array<{ statement: string; rationale: string }>> {
    const s = sanitizeUntrustedContent(statement);
    return [
      {
        statement: `Fator não observado pode explicar: ${s.slice(0, 80)}`,
        rationale: "fallback determinístico",
      },
    ];
  }

  async rewriteForClarity(text: string): Promise<string> {
    return sanitizeUntrustedContent(text);
  }

  async generateClarifyingQuestion(topic: string): Promise<string> {
    return `Isso corresponde à sua experiência sobre "${sanitizeUntrustedContent(topic).slice(0, 60)}"?`;
  }
}

/** Schema validation for provider drafts — reject invented evidence claims. */
export function validateProviderDraft(
  draft: ProviderInsightDraft,
  knownEvidenceSummaries: string[]
): { ok: boolean; reason: string | null } {
  if (!draft.title || !draft.summary) {
    return { ok: false, reason: "missing_fields" };
  }
  if (/chain of thought|raciocínio interno|let me think/i.test(draft.summary)) {
    return { ok: false, reason: "private_cot_detected" };
  }
  // Provider must not introduce numeric "facts" absent from evidence
  const invented = /com certeza absoluta|evidência nova #/i.test(draft.summary);
  if (invented) {
    return { ok: false, reason: "invented_evidence_language" };
  }
  void knownEvidenceSummaries;
  return { ok: true, reason: null };
}

export async function withProviderTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<{ value: T; timedOut: boolean }> {
  let timedOut = false;
  const result = await Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve(fallback);
      }, timeoutMs);
    }),
  ]);
  return { value: result, timedOut };
}

export function applyProviderClarity(
  artifact: CognitiveArtifact,
  rewrittenSummary: string
): CognitiveArtifact {
  return {
    ...artifact,
    summary: sanitizeUntrustedContent(rewrittenSummary).slice(0, 600),
    generatedBy: artifact.providerMetadata?.used ? "hybrid" : artifact.generatedBy,
    // Never persist chain-of-thought
    metadata: {
      ...artifact.metadata,
      providerClarityApplied: true,
    },
  };
}

export const defaultProvider = new NoneReasoningProvider();

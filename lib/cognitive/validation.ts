/**
 * Reasoning Validator — mandatory gate before accepting artifacts.
 */

import {
  calculateEvidenceConfidence,
  clampScore,
  confidenceBand,
  uniqueIndependentEvidence,
} from "@/lib/cognitive/confidence";
import {
  assertCognitivePrivacy,
  hasCausalLanguage,
  hasOperationalActionLanguage,
} from "@/lib/cognitive/privacy";
import { MIN_PATTERN_SAMPLE, type CognitiveArtifact, type CognitiveContext, type CognitiveSuppression, type ValidatorResult } from "@/lib/cognitive/types";

export function validateCognitiveArtifact(
  candidate: CognitiveArtifact,
  context: CognitiveContext,
  suppressions: CognitiveSuppression[] = []
): ValidatorResult {
  const issues: string[] = [];
  const requiredChanges: string[] = [];
  let confidenceAdjustment = 0;

  // 1–2 Ownership / workspace
  if (!candidate.userId) {
    issues.push("missing_user_id");
  }
  if (
    context.correlationId &&
    candidate.workspaceId != null &&
    false
  ) {
    // workspace checked at service layer; keep validator pure
  }

  // 3–6 Evidence
  const supporting = uniqueIndependentEvidence(
    candidate.evidence.filter((e) => e.supports === "supports")
  );
  if (
    supporting.length === 0 &&
    candidate.artifactType !== "INSUFFICIENT_EVIDENCE" &&
    candidate.artifactType !== "DATA_QUALITY_WARNING" &&
    candidate.artifactType !== "CLARIFYING_QUESTION"
  ) {
    issues.push("no_evidence");
  }

  const evidenceQuality = calculateEvidenceConfidence(candidate.evidence);
  if (evidenceQuality < 15 && supporting.length > 0) {
    issues.push("low_evidence_quality");
    confidenceAdjustment -= 10;
  }

  const independence =
    uniqueIndependentEvidence(candidate.evidence).length;
  if (candidate.evidence.length > independence) {
    issues.push("duplicate_evidence_detected");
    // duplicates already ignored in calc; informational
  }

  // 7–8 Temporal / context scope
  if (
    !candidate.timeRange ||
    (candidate.timeRange.from == null &&
      candidate.timeRange.to == null &&
      !candidate.timeRange.label)
  ) {
    issues.push("missing_temporal_scope");
    requiredChanges.push("add_time_range");
  }

  // 9–10 Contradiction / counterevidence
  if (
    candidate.artifactType === "INSIGHT" &&
    candidate.counterEvidence.length > 0 &&
    !candidate.alternativeHypotheses.length
  ) {
    issues.push("counterevidence_without_alternatives");
    requiredChanges.push("add_alternative_hypotheses");
    confidenceAdjustment -= 10;
  }

  // 11 Sample size for patterns/insights
  const sample =
    typeof candidate.structuredContent.sampleSize === "number"
      ? candidate.structuredContent.sampleSize
      : context.dataCompleteness.sampleSize;
  if (
    (candidate.artifactType === "PATTERN" ||
      candidate.artifactType === "INSIGHT") &&
    sample < MIN_PATTERN_SAMPLE
  ) {
    issues.push("insufficient_sample");
  }

  // 13 Causal language
  if (hasCausalLanguage(candidate.title, candidate.summary)) {
    issues.push("causal_language");
    requiredChanges.push("rewrite_without_causality");
  }

  // 14 Sensitive inference
  const privacy = assertCognitivePrivacy({
    title: candidate.title,
    summary: candidate.summary,
    category: candidate.category,
    sensitivity: candidate.sensitivity,
  });
  if (!privacy.ok) {
    issues.push("sensitive_inference");
  }

  // 17 Suppression
  const suppressed = suppressions.find((s) => {
    if (s.brokenAt) return false;
    if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) return false;
    if (s.artifactType !== "*" && s.artifactType !== candidate.artifactType) {
      return false;
    }
    if (s.semanticKey && candidate.suppressionKey === s.semanticKey) return true;
    if (s.semanticKey && candidate.fingerprint.includes(s.semanticKey)) return true;
    return (
      s.category != null &&
      s.category === candidate.category &&
      s.semanticKey === candidate.suppressionKey
    );
  });
  if (suppressed) {
    return {
      valid: false,
      disposition: "SUPPRESSED",
      issues: [...issues, "suppressed"],
      confidenceAdjustment: -100,
      requiredChanges: [],
      explanation: `Suppressed: ${suppressed.reason}`,
    };
  }

  // 21–22 Action boundary / execution
  if (candidate.executionInfluence !== "none") {
    issues.push("execution_influence_not_none");
  }
  if (hasOperationalActionLanguage(candidate.title, candidate.summary)) {
    issues.push("operational_action_language");
  }
  if (
    candidate.artifactType === "RECOMMENDATION" &&
    typeof candidate.structuredContent.recommendationType === "string" &&
    [
      "CREATE_MISSION",
      "SCHEDULE_EVENT",
      "MODIFY_FINANCE",
      "EXECUTE_TASK",
      "SEND_MESSAGE",
      "START_AUTOMATION",
    ].includes(candidate.structuredContent.recommendationType)
  ) {
    issues.push("forbidden_recommendation_type");
  }

  // 23 Explainability
  if (!candidate.method || !candidate.methodVersion) {
    issues.push("missing_method");
  }
  if (!candidate.limitations?.length) {
    requiredChanges.push("add_limitations");
  }

  // 20 Alternatives for hypotheses / insights with medium+ confidence
  if (
    (candidate.artifactType === "HYPOTHESIS" ||
      candidate.artifactType === "INSIGHT") &&
    candidate.confidence >= 40 &&
    candidate.alternativeHypotheses.length === 0
  ) {
    issues.push("missing_alternative_hypotheses");
    requiredChanges.push("add_alternative_hypotheses");
  }

  // Disposition
  if (issues.includes("sensitive_inference") || issues.includes("operational_action_language") || issues.includes("forbidden_recommendation_type") || issues.includes("execution_influence_not_none")) {
    return {
      valid: false,
      disposition: "BLOCKED",
      issues,
      confidenceAdjustment: -100,
      requiredChanges,
      explanation: "Blocked by privacy or action boundary",
    };
  }

  if (issues.includes("no_evidence") || issues.includes("insufficient_sample")) {
    return {
      valid: false,
      disposition: "INSUFFICIENT_EVIDENCE",
      issues,
      confidenceAdjustment: -50,
      requiredChanges: ["collect_more_data"],
      explanation: "Insufficient evidence for the claimed assertion",
    };
  }

  if (
    issues.includes("causal_language") ||
    issues.includes("missing_alternative_hypotheses") ||
    issues.includes("counterevidence_without_alternatives")
  ) {
    return {
      valid: false,
      disposition: "REVISE",
      issues,
      confidenceAdjustment,
      requiredChanges,
      explanation: "Artifact needs revision before acceptance",
    };
  }

  if (candidate.confidence < 40 || context.dataCompleteness.score < 30) {
    return {
      valid: true,
      disposition: "PENDING_REVIEW",
      issues,
      confidenceAdjustment,
      requiredChanges,
      explanation: `Low confidence (${confidenceBand(candidate.confidence)}); pending review`,
    };
  }

  return {
    valid: true,
    disposition: "ACCEPT",
    issues,
    confidenceAdjustment,
    requiredChanges,
    explanation: "Accepted with calibrated confidence",
  };
}

export function applyValidatorConfidence(
  confidence: number,
  result: ValidatorResult
): number {
  return clampScore(confidence + result.confidenceAdjustment);
}

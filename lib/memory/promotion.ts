/**
 * Memory Promotion Engine V1.
 * Evaluates whether a memory may propose Identity claims / evidence / future graph.
 * Never silently confirms, never overwrites corrected/rejected claims.
 */

import { confidenceBand, isIsolatedInteractionSource } from "@/lib/memory/confidence";
import { isRestrictedMemoryText } from "@/lib/memory/privacy";
import type {
  MemoryPromotionResult,
  MemoryRecord,
  PromotionDecision,
  SemanticContent,
} from "@/lib/memory/types";

export type IdentityGateSnapshot = {
  /** Existing confirmed / corrected / rejected / archived claims for same semantic key */
  existingClaims: Array<{
    key: string;
    status: string;
    category: string;
    value: unknown;
  }>;
};

function gate(
  name: string,
  passed: boolean,
  detail: string
): { name: string; passed: boolean; detail: string } {
  return { name, passed, detail };
}

export function evaluateMemoryForPromotionPure(
  memory: MemoryRecord,
  identity?: IdentityGateSnapshot
): MemoryPromotionResult {
  const gates: MemoryPromotionResult["gates"] = [];

  // 1. Ownership — caller must already scope; recorded as passed if userId present
  gates.push(
    gate("ownership", Boolean(memory.userId), memory.userId ? "owner ok" : "missing user")
  );

  // 2. Workspace isolation — memory carries workspaceId; cross-user never allowed upstream
  gates.push(
    gate(
      "workspace_isolation",
      true,
      memory.workspaceId ? `workspace ${memory.workspaceId}` : "personal scope"
    )
  );

  // 3. Privacy
  const privacyBlocked =
    memory.sensitivity === "RESTRICTED" ||
    isRestrictedMemoryText(memory.title, memory.content, memory.semanticKey);
  gates.push(
    gate(
      "privacy",
      !privacyBlocked ||
        memory.sourceType === "user_explicit" ||
        memory.sourceType === "manual_entry",
      privacyBlocked ? "sensitive content" : "ok"
    )
  );

  // 4. Sensitivity — no auto promotion of SENSITIVE/RESTRICTED
  const sensOk =
    memory.sensitivity === "PUBLIC_PREF" ||
    memory.sensitivity === "STANDARD" ||
    ((memory.sourceType === "user_explicit" || memory.sourceType === "manual_entry") &&
      memory.status === "CONFIRMED");
  gates.push(
    gate(
      "sensitivity",
      sensOk && memory.sensitivity !== "RESTRICTED",
      `sensitivity=${memory.sensitivity}`
    )
  );

  // 5. Source reliability
  const isolated = isIsolatedInteractionSource(memory.sourceType);
  gates.push(
    gate(
      "source_reliability",
      !isolated || memory.sourceType === "user_explicit",
      isolated ? "isolated interaction source" : "ok"
    )
  );

  // 6. Confidence
  const confOk = memory.confidence >= 40 || memory.status === "CONFIRMED";
  gates.push(
    gate("confidence", confOk, `confidence=${memory.confidence} band=${memory.confidenceBand}`)
  );

  // 7. Evidence count
  const evidenceOk =
    memory.evidence.length >= 1 &&
    (memory.status === "CONFIRMED" ||
      memory.sourceType === "user_explicit" ||
      memory.sourceType === "manual_entry" ||
      memory.evidence.length >= 2);
  gates.push(
    gate("evidence_count", evidenceOk, `evidence=${memory.evidence.length}`)
  );

  // 8. Contradiction
  const disputed = memory.status === "DISPUTED";
  gates.push(gate("contradiction", !disputed, disputed ? "disputed" : "ok"));

  // 9–10. User correction / rejection history on Identity
  const semantic =
    memory.structuredContent.kind === "semantic"
      ? (memory.structuredContent as SemanticContent)
      : null;
  const key = memory.semanticKey ?? semantic?.factKey ?? null;
  const related = key
    ? (identity?.existingClaims ?? []).filter((c) => c.key === key)
    : [];
  const blockedByHuman = related.some((c) =>
    ["REJECTED", "ARCHIVED", "CONFIRMED"].includes(c.status)
  );
  // Confirmed claims: may ATTACH evidence, never overwrite
  const hasConfirmed = related.some((c) => c.status === "CONFIRMED");
  const hasRejected = related.some((c) => c.status === "REJECTED");
  const hasCorrectedHint = related.some(
    (c) => c.status === "OUTDATED" || String(c.status).includes("CORRECT")
  );

  gates.push(
    gate(
      "user_correction",
      !hasCorrectedHint || hasConfirmed,
      hasCorrectedHint ? "prior human correction present" : "ok"
    )
  );
  gates.push(
    gate(
      "rejection_history",
      !hasRejected,
      hasRejected ? "claim previously rejected — needs new explicit declaration" : "ok"
    )
  );

  // 11. Context — reflective needs review; search never promotes
  const contextOk =
    memory.memoryType !== "REFLECTIVE" || memory.status === "CONFIRMED";
  gates.push(
    gate(
      "context",
      contextOk && memory.sourceType !== "search_or_browse",
      memory.memoryType === "REFLECTIVE"
        ? "reflective requires confirmation"
        : memory.sourceType === "search_or_browse"
          ? "search/browse never promotes"
          : "ok"
    )
  );

  // 12. Idempotency — already promoted
  const already =
    memory.promotionStatus === "PROPOSED_IDENTITY" ||
    memory.promotionStatus === "ATTACHED_EVIDENCE" ||
    memory.promotionStatus === "PROMOTED";
  gates.push(
    gate("idempotency", !already, already ? `already ${memory.promotionStatus}` : "ok")
  );

  const allCritical = gates.filter((g) =>
    [
      "ownership",
      "privacy",
      "sensitivity",
      "contradiction",
      "rejection_history",
      "idempotency",
    ].includes(g.name)
  );
  const criticalFail = allCritical.some((g) => !g.passed);
  const sourceFail = !gates.find((g) => g.name === "source_reliability")!.passed;
  const contextFail = !gates.find((g) => g.name === "context")!.passed;

  let decision: PromotionDecision = "NO_PROMOTION";
  let reason = "Gates não satisfeitos ou memória não elegível";
  let requiresUserConfirmation = true;
  let promotionConfidence = Math.min(memory.confidence, isolated ? 30 : memory.confidence);

  if (memory.status === "REJECTED" || memory.status === "DELETED" || memory.duplicateOfMemoryId) {
    decision = "NO_PROMOTION";
    reason = "Memória rejeitada, deletada ou duplicata";
  } else if (memory.sourceType === "search_or_browse") {
    decision = "NO_PROMOTION";
    reason = "Pesquisa/visualização isolada nunca vira identidade ou objetivo";
    promotionConfidence = 0;
  } else if (criticalFail) {
    decision = "NO_PROMOTION";
    reason = allCritical.find((g) => !g.passed)?.detail ?? reason;
  } else if (memory.memoryType === "REFLECTIVE" && memory.status !== "CONFIRMED") {
    // Safe path: queue for human review even when source is weak
    decision = "QUEUE_FOR_REVIEW";
    reason = "Memória reflexiva exige revisão antes de Identity (V1)";
    promotionConfidence = Math.min(promotionConfidence, 50);
  } else if (sourceFail || contextFail) {
    decision = "NO_PROMOTION";
    reason =
      gates.find((g) => (g.name === "source_reliability" || g.name === "context") && !g.passed)
        ?.detail ?? reason;
  } else if (
    memory.memoryType === "SEMANTIC" &&
    (memory.sourceType === "user_explicit" ||
      memory.sourceType === "manual_entry" ||
      memory.status === "CONFIRMED")
  ) {
    if (hasConfirmed) {
      decision = "ATTACH_IDENTITY_EVIDENCE";
      reason = "Anexar evidência a claim confirmada existente (sem sobrescrever)";
      requiresUserConfirmation = false;
      promotionConfidence = Math.min(85, memory.confidence);
    } else if (hasRejected) {
      decision = "NO_PROMOTION";
      reason = "Claim rejeitada — não recriar sem nova declaração explícita rastreável";
    } else {
      decision = "PROPOSE_IDENTITY_CLAIM";
      reason = "Declaração/fato explícito elegível para proposta de claim";
      requiresUserConfirmation = memory.status !== "CONFIRMED";
      promotionConfidence = memory.status === "CONFIRMED" ? 90 : Math.min(75, memory.confidence);
    }
  } else if (memory.memoryType === "EPISODIC" && memory.sourceType === "mission_engine") {
    decision = "ATTACH_IDENTITY_EVIDENCE";
    reason = "Missão explícita pode gerar evidência de objetivo (com temporalidade)";
    requiresUserConfirmation = true;
    promotionConfidence = Math.min(55, memory.confidence);
  } else if (memory.confidence >= 70 && memory.evidence.length >= 2 && !isolated) {
    decision = "QUEUE_FOR_REVIEW";
    reason = "Padrão com evidências independentes — aguardar revisão";
    promotionConfidence = Math.min(60, memory.confidence);
  } else if (memory.memoryType === "SEMANTIC" && memory.confidence >= 40) {
    decision = "FUTURE_GRAPH_CANDIDATE";
    reason = "Candidato futuro ao Knowledge Graph (não implementado nesta sprint)";
    promotionConfidence = Math.min(50, memory.confidence);
  } else {
    decision = "NO_PROMOTION";
    reason = "Sem critério de promoção atendido";
  }

  const target =
    decision === "PROPOSE_IDENTITY_CLAIM" || decision === "ATTACH_IDENTITY_EVIDENCE"
      ? {
          category:
            memory.structuredContent.kind === "semantic" ? "preference" : "goal",
          key: key ?? memory.id,
          value:
            semantic?.factValue ??
            memory.metadata?.value ??
            memory.content,
          label: memory.title,
          existingClaimHint: hasConfirmed ? key : null,
        }
      : null;

  return {
    decision,
    reason,
    confidence: memory.confidence,
    promotionConfidence,
    gates,
    target,
    requiresUserConfirmation,
    memoryId: memory.id,
  };
}

export function promotionBand(score: number) {
  return confidenceBand(score);
}

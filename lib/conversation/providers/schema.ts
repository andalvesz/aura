/**
 * Provider schema — LLM may classify/redact only. No tools, no DB, no execute.
 */

import type { ConversationIntentKind } from "@/lib/conversation/types";

export type ProviderIntentSuggestion = {
  kind: ConversationIntentKind;
  confidence: number;
  rationaleShort: string;
};

const KINDS = new Set<ConversationIntentKind>([
  "NAVIGATE",
  "SEARCH",
  "SUMMARIZE",
  "EXPLAIN",
  "COMPARE",
  "REVIEW",
  "ASK_STATUS",
  "CREATE_DRAFT",
  "PROPOSE_PLAN",
  "PROPOSE_AUTOMATION",
  "START_AGENT_SESSION",
  "CONFIRM_ACTION",
  "CANCEL_ACTION",
  "PROVIDE_INPUT",
  "UPDATE_CONTEXT",
  "UNKNOWN",
]);

export function validateProviderIntentOutput(
  raw: unknown
): { ok: true; value: ProviderIntentSuggestion } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "provider_output_not_object" };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.kind !== "string" || !KINDS.has(o.kind as ConversationIntentKind)) {
    return { ok: false, error: "invalid_kind" };
  }
  if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) {
    return { ok: false, error: "invalid_confidence" };
  }
  if (typeof o.rationaleShort !== "string" || o.rationaleShort.length > 200) {
    return { ok: false, error: "invalid_rationale" };
  }
  // Reject if provider tries to smuggle tools
  if ("tools" in o || "execute" in o || "sql" in o || "fetch" in o) {
    return { ok: false, error: "forbidden_fields" };
  }
  return {
    ok: true,
    value: {
      kind: o.kind as ConversationIntentKind,
      confidence: o.confidence,
      rationaleShort: o.rationaleShort,
    },
  };
}

/** Deterministic stub provider — no network. */
export function deterministicSuggestIntent(
  message: string
): ProviderIntentSuggestion {
  const q = message.toLowerCase();
  if (/abrir|mostre|v[aá] para/.test(q))
    return { kind: "NAVIGATE", confidence: 0.6, rationaleShort: "nav cues" };
  if (/encontr|busc|procur|documento/.test(q))
    return { kind: "SEARCH", confidence: 0.6, rationaleShort: "search cues" };
  if (/resum/.test(q))
    return { kind: "SUMMARIZE", confidence: 0.6, rationaleShort: "summary cues" };
  if (/plano/.test(q) && /cri|rascunho|transform/.test(q))
    return { kind: "PROPOSE_PLAN", confidence: 0.55, rationaleShort: "plan cues" };
  return { kind: "UNKNOWN", confidence: 0.3, rationaleShort: "fallback" };
}

export function providerTimeoutFallback(): ProviderIntentSuggestion {
  return { kind: "UNKNOWN", confidence: 0, rationaleShort: "timeout" };
}

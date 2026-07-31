/**
 * Provider / LLM boundary — suggest among allowed options only.
 * Deterministic fallback. Never creates tools/actions or executes.
 */

import type { AgentDefinition, AgentStep } from "@/lib/agent-runtime/types";
import { detectPromptInjection } from "@/lib/agent-runtime/context-builder";

export type ProviderSuggestion = {
  nextActionId: string | null;
  explanation: string;
  question: string | null;
  draftText: string | null;
  source: "deterministic" | "provider";
};

export type ProviderInput = {
  agent: AgentDefinition;
  objective: string;
  pendingSteps: AgentStep[];
  allowedActionIds: string[];
  userMessage?: string | null;
};

/**
 * Schema-validated suggestion. Provider cannot invent actionIds.
 */
export function suggestNextStep(input: ProviderInput): ProviderSuggestion {
  if (input.userMessage && detectPromptInjection(input.userMessage)) {
    return {
      nextActionId: null,
      explanation:
        "Mensagem do usuário contém instruções suspeitas — ignoradas pelo runtime.",
      question: "Pode reformular o objetivo sem instruções de sistema?",
      draftText: null,
      source: "deterministic",
    };
  }

  // Attempt "provider" path — still constrained to allowlist
  const providerAttempt = constrainedProviderSuggest(input);
  if (providerAttempt) return providerAttempt;

  return deterministicSuggest(input);
}

function constrainedProviderSuggest(
  input: ProviderInput
): ProviderSuggestion | null {
  // No live LLM required in V1 tests — simulate schema-gated suggestion
  // that only picks from allowedActionIds. If "provider" would invent a tool, reject.
  const forged = null as string | null;
  if (forged && !input.allowedActionIds.includes(forged)) {
    return {
      nextActionId: null,
      explanation: "provider_attempted_unauthorized_tool",
      question: null,
      draftText: null,
      source: "provider",
    };
  }
  return null; // fall through to deterministic
}

export function deterministicSuggest(
  input: ProviderInput
): ProviderSuggestion {
  const pending = input.pendingSteps.find((s) => s.status === "PENDING");
  if (pending?.actionId && input.allowedActionIds.includes(pending.actionId)) {
    return {
      nextActionId: pending.actionId,
      explanation: `Próximo passo do plano: ${pending.title}`,
      question: null,
      draftText: pending.title,
      source: "deterministic",
    };
  }

  const preferred =
    input.allowedActionIds.find((id) => id.includes("notification")) ??
    input.allowedActionIds[0] ??
    null;

  return {
    nextActionId: preferred,
    explanation: `Sugestão determinística alinhada ao agente ${input.agent.name}`,
    question:
      input.agent.id === "business_preparation_v1"
        ? "Qual hipótese de negócio devemos estruturar?"
        : null,
    draftText: input.objective.slice(0, 200),
    source: "deterministic",
  };
}

export function validateProviderOutput(raw: unknown): {
  ok: boolean;
  suggestion: ProviderSuggestion | null;
  error: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { ok: false, suggestion: null, error: "invalid_schema" };
  }
  const o = raw as Record<string, unknown>;
  if (o.createTool || o.newTool || o.execute === true) {
    return { ok: false, suggestion: null, error: "provider_forbidden_capability" };
  }
  return {
    ok: true,
    suggestion: {
      nextActionId:
        typeof o.nextActionId === "string" ? o.nextActionId : null,
      explanation:
        typeof o.explanation === "string" ? o.explanation : "sem explicação",
      question: typeof o.question === "string" ? o.question : null,
      draftText: typeof o.draftText === "string" ? o.draftText : null,
      source: "provider",
    },
    error: null,
  };
}

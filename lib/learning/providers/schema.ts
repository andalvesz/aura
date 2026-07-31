/**
 * Provider schema — may summarize only. Never creates signals or applies proposals.
 */

export type ProviderProposalDraft = {
  title: string;
  summary: string;
  expectedBenefit: string;
};

export function validateProviderProposalDraft(
  raw: unknown
): { ok: true; value: ProviderProposalDraft } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "not_object" };
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string" || o.title.length > 120) {
    return { ok: false, error: "invalid_title" };
  }
  if (typeof o.summary !== "string" || o.summary.length > 500) {
    return { ok: false, error: "invalid_summary" };
  }
  if (typeof o.expectedBenefit !== "string" || o.expectedBenefit.length > 300) {
    return { ok: false, error: "invalid_benefit" };
  }
  if (
    "apply" in o ||
    "tools" in o ||
    "confidence" in o ||
    "weight" in o ||
    "sql" in o
  ) {
    return { ok: false, error: "forbidden_fields" };
  }
  return {
    ok: true,
    value: {
      title: o.title,
      summary: o.summary,
      expectedBenefit: o.expectedBenefit,
    },
  };
}

export function deterministicProposalCopy(patternTitle: string): ProviderProposalDraft {
  return {
    title: `Aprender: ${patternTitle}`,
    summary: "Proposta gerada deterministicamente a partir de sinais observados.",
    expectedBenefit: "Melhor alinhamento com feedback do usuário.",
  };
}

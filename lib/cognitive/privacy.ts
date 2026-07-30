/**
 * Privacy gates — ADR-007 · ADR-008
 */

import type { CognitiveSensitivity } from "@/lib/cognitive/types";

const RESTRICTED = [
  /medical|diagnos|disease|disorder|clinical|psicolog|psychiatr|mental_health|personality|depress|ansiedade clínica/i,
  /sexual|orientation|relig|politic|ethnic|race|biometric|genetic/i,
  /legal_case|criminal|lawsuit|cpf|passport_number|ssn/i,
  /password|secret|token|credential/i,
];

const CAUSAL = [
  /\bcausa\b/i,
  /\bcausam\b/i,
  /\bcausou\b/i,
  /\bcauses?\b/i,
  /\bbecause of\b/i,
  /\bdevido a\b/i,
  /\bprovoca\b/i,
  /\bleads? to\b/i,
  /\bresulta em\b/i,
];

const OPERATIONAL = [
  /\bagendei\b/i,
  /\bcriei a missão\b/i,
  /\bexecutei\b/i,
  /\benviei mensagem\b/i,
  /\balterei a agenda\b/i,
  /\bCREATE_MISSION\b/,
  /\bSCHEDULE_EVENT\b/,
  /\bMODIFY_FINANCE\b/,
  /\bEXECUTE_TASK\b/,
  /\bSEND_MESSAGE\b/,
  /\bSTART_AUTOMATION\b/,
];

export function isRestrictedText(
  ...parts: Array<string | null | undefined>
): boolean {
  const blob = parts.filter(Boolean).join(" ");
  return RESTRICTED.some((re) => re.test(blob));
}

export function hasCausalLanguage(
  ...parts: Array<string | null | undefined>
): boolean {
  const blob = parts.filter(Boolean).join(" ");
  return CAUSAL.some((re) => re.test(blob));
}

export function hasOperationalActionLanguage(
  ...parts: Array<string | null | undefined>
): boolean {
  const blob = parts.filter(Boolean).join(" ");
  return OPERATIONAL.some((re) => re.test(blob));
}

export function assertCognitivePrivacy(input: {
  title: string;
  summary?: string;
  category?: string;
  sensitivity?: CognitiveSensitivity;
  allowExplicit?: boolean;
}): { ok: boolean; reason: string | null; forceSensitivity?: CognitiveSensitivity } {
  if (isRestrictedText(input.title, input.summary, input.category)) {
    if (/diagnos|clinical|disorder|psicolog|psychiatr|personality/i.test(
      `${input.title} ${input.summary ?? ""} ${input.category ?? ""}`
    )) {
      return {
        ok: false,
        reason: "Classificações psicológicas ou clínicas não são suportadas",
      };
    }
    if (!input.allowExplicit) {
      return {
        ok: false,
        reason: "Inferência automática bloqueada para conteúdo sensível (ADR-007)",
      };
    }
    return { ok: true, reason: null, forceSensitivity: "RESTRICTED" };
  }
  return { ok: true, reason: null };
}

export function cognitiveVisibleInScope(input: {
  ownerUserId: string;
  ownerWorkspaceId: string | null;
  viewerUserId: string;
  viewerWorkspaceId: string | null;
  mode: "personal" | "workspace";
}): boolean {
  if (input.ownerUserId !== input.viewerUserId) return false;
  if (input.mode === "personal") {
    return (
      input.ownerWorkspaceId == null ||
      input.ownerWorkspaceId === input.viewerWorkspaceId
    );
  }
  return (
    input.ownerWorkspaceId != null &&
    input.ownerWorkspaceId === input.viewerWorkspaceId
  );
}

/** Treat untrusted text as data — strip instruction-like prefixes for prompts. */
export function sanitizeUntrustedContent(text: string): string {
  return text
    .replace(
      /\b(system|assistant|ignore\s+previous(?:\s+\w+)?|forget(?:\s+\w+)?|you\s+are)\b[^.\n]{0,80}/gim,
      "[conteúdo]"
    )
    .replace(/```[\s\S]*?```/g, "[bloco removido]")
    .slice(0, 2000);
}

export function redactForProvider(input: {
  title: string;
  summary: string;
  evidenceSummaries: string[];
}): {
  title: string;
  summary: string;
  evidenceSummaries: string[];
  redacted: boolean;
} {
  const redacted =
    isRestrictedText(input.title, input.summary, ...input.evidenceSummaries);
  if (!redacted) {
    return {
      title: sanitizeUntrustedContent(input.title),
      summary: sanitizeUntrustedContent(input.summary),
      evidenceSummaries: input.evidenceSummaries.map(sanitizeUntrustedContent),
      redacted: false,
    };
  }
  return {
    title: "[redacted]",
    summary: "[conteúdo sensível removido]",
    evidenceSummaries: [],
    redacted: true,
  };
}

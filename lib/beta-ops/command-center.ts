/**
 * Command Center intents for feedback / changelog / known issues.
 */

import { listReleasedChangelog, getCurrentReleaseVersion } from "@/lib/beta-ops/releases";
import { getBetaOpsState } from "@/lib/beta-ops/store";

export const BETA_OPS_COMMAND_PATTERNS = {
  reportProblem: /reportar\s+(um\s+)?problema/i,
  responseNotHelpful: /esta\s+resposta\s+n[aã]o\s+ajudou/i,
  suggestImprovement: /quero\s+sugerir\s+(uma\s+)?melhoria/i,
  whatChanged: /o\s+que\s+mudou\s+(na\s+)?(última|ultima)\s+vers[aã]o/i,
  knownIssues: /existe\s+algum\s+problema\s+conhecido/i,
};

export type BetaOpsCommandCard =
  | {
      kind: "feedback_form";
      type: "BUG" | "CONFUSING" | "IDEA";
      title: string;
      prefill: string;
    }
  | {
      kind: "changelog";
      version: string | null;
      summary: string;
      knownIssues: string[];
    };

export type BetaOpsCommandResult = {
  message: string;
  card: BetaOpsCommandCard | null;
};

export function handleBetaOpsCommand(message: string): BetaOpsCommandResult {
  const text = message.trim();

  if (BETA_OPS_COMMAND_PATTERNS.reportProblem.test(text)) {
    return {
      message: "Abra o card para reportar o problema com contexto sanitizado.",
      card: {
        kind: "feedback_form",
        type: "BUG",
        title: "Reportar um problema",
        prefill: text,
      },
    };
  }
  if (BETA_OPS_COMMAND_PATTERNS.responseNotHelpful.test(text)) {
    return {
      message: "Obrigado pelo sinal. Use o card para detalhar o que faltou.",
      card: {
        kind: "feedback_form",
        type: "CONFUSING",
        title: "Esta resposta não ajudou",
        prefill: text,
      },
    };
  }
  if (BETA_OPS_COMMAND_PATTERNS.suggestImprovement.test(text)) {
    return {
      message: "Ótimo — capture a ideia no card estruturado.",
      card: {
        kind: "feedback_form",
        type: "IDEA",
        title: "Sugerir melhoria",
        prefill: text,
      },
    };
  }
  if (BETA_OPS_COMMAND_PATTERNS.whatChanged.test(text)) {
    const releases = listReleasedChangelog(getBetaOpsState());
    const latest = releases[0] ?? null;
    return {
      message: latest
        ? `Versão ${latest.version}: ${latest.summary}`
        : "Nenhuma release publicada ainda.",
      card: {
        kind: "changelog",
        version: latest?.version ?? getCurrentReleaseVersion(),
        summary: latest?.summary ?? "Sem changelog publicado.",
        knownIssues: latest?.knownIssues ?? [],
      },
    };
  }
  if (BETA_OPS_COMMAND_PATTERNS.knownIssues.test(text)) {
    const releases = listReleasedChangelog(getBetaOpsState());
    const issues = releases.flatMap((r) => r.knownIssues).slice(0, 10);
    return {
      message:
        issues.length > 0
          ? `Problemas conhecidos: ${issues.join("; ")}`
          : "Nenhum problema conhecido publicado no momento.",
      card: {
        kind: "changelog",
        version: getCurrentReleaseVersion(),
        summary: "Problemas conhecidos",
        knownIssues: issues,
      },
    };
  }

  return { message: "", card: null };
}

/**
 * Response composer — evidence-based answers, no chain-of-thought.
 */

import { formatSourcesBlock, toCitations } from "@/lib/conversation/citations";
import type {
  ConversationExplanation,
  ConversationIntent,
  ConversationResolvedContext,
  ConversationSourceRef,
} from "@/lib/conversation/types";

export function composeExplanation(input: {
  intent: ConversationIntent;
  context: ConversationResolvedContext;
  rules: string[];
  executedAnything?: boolean;
  executedSummary?: string | null;
}): ConversationExplanation {
  const citations = toCitations(input.context.sources);
  return {
    why: `Intenção ${input.intent.kind} com confiança ${input.intent.confidence.toFixed(2)}.`,
    evidence: input.context.sources.slice(0, 6).map((s) => s.title),
    rules: input.rules,
    sources: citations,
    premises: [
      `Contexto: ${input.context.focus.label}`,
      `Handlers permitidos: ${input.intent.allowedHandlers.join(", ")}`,
    ],
    limitations: input.context.gaps.length
      ? input.context.gaps.map((g) => `Lacuna: ${g}`)
      : ["Resposta limitada às fontes carregadas no budget."],
    confidence: input.intent.confidence,
    missing: input.intent.missingInformation,
    alternativeInterpretations: input.intent.ambiguity,
    executedAnything: Boolean(input.executedAnything),
    executedSummary: input.executedSummary ?? null,
    confirmedByUser: false,
  };
}

export function composeStatusAnswer(
  intent: ConversationIntent,
  context: ConversationResolvedContext
): string {
  const risks = context.sources.filter((s) => s.kind === "risk");
  const next = context.sources.filter((s) => s.kind === "next_action");
  const parts: string[] = [];

  if (intent.query.toLowerCase().includes("atenção") || intent.targetType === "day") {
    parts.push("Hoje, o que merece atenção:");
    if (next.length) {
      parts.push(...next.slice(0, 5).map((n) => `• ${n.title}`));
    } else {
      parts.push("• Nenhuma próxima ação crítica no contexto carregado.");
    }
    if (risks.length) {
      parts.push("Riscos em evidência:");
      parts.push(...risks.slice(0, 3).map((r) => `• ${r.title}`));
    }
  } else if (risks.length) {
    parts.push("Riscos encontrados:");
    parts.push(...risks.map((r) => `• ${r.title}`));
  } else {
    parts.push(
      `Status no contexto “${context.focus.label}”: sem alertas críticos nas fontes carregadas.`
    );
  }

  parts.push("");
  parts.push(formatSourcesBlock(toCitations(context.sources)));
  return parts.join("\n");
}

export function composeSummaryAnswer(
  intent: ConversationIntent,
  context: ConversationResolvedContext
): string {
  const lines = [
    `Resumo — ${context.focus.label}`,
    "",
    ...context.sources.slice(0, 8).map((s) => `• [${s.kind}] ${s.title}`),
    "",
    formatSourcesBlock(toCitations(context.sources)),
    "",
    "Limitações: resumo baseado apenas nas fontes autorizadas deste turno; conteúdo externo é tratado como não confiável.",
  ];
  if (!context.sources.length) {
    return `Não encontrei dados suficientes para resumir “${intent.targetType}”.`;
  }
  return lines.join("\n");
}

export function composeSearchAnswer(
  results: ConversationSourceRef[],
  query: string
): string {
  if (!results.length) {
    return `Não encontrei dados suficientes para “${query}".`;
  }
  const grouped = new Map<string, ConversationSourceRef[]>();
  for (const r of results) {
    const list = grouped.get(r.kind) ?? [];
    list.push(r);
    grouped.set(r.kind, list);
  }
  const parts = [`Resultados para “${query}”:`];
  for (const [kind, items] of grouped) {
    parts.push(`\n${kind}:`);
    for (const i of items.slice(0, 5)) {
      parts.push(`• ${i.title}`);
    }
  }
  parts.push("");
  parts.push(formatSourcesBlock(toCitations(results)));
  return parts.join("\n");
}

export function composeNavigateAnswer(href: string, label: string): string {
  return `Posso abrir **${label}** com segurança.\nRota: ${href}`;
}

export function composeUnknownAnswer(intent: ConversationIntent): string {
  return [
    "Não tenho certeza do que você precisa.",
    intent.ambiguity[0] ?? "Pode reformular?",
    "Exemplos: “O que merece minha atenção hoje?”, “Abra meus projetos.”, “Encontre documentos sobre marketing.”",
  ].join("\n");
}

export function composeExplainAnswer(expl: ConversationExplanation): string {
  return [
    expl.why,
    "",
    "Evidências:",
    ...expl.evidence.map((e) => `• ${e}`),
    "",
    "Regras aplicadas:",
    ...expl.rules.map((r) => `• ${r}`),
    "",
    `Confiança: ${(expl.confidence * 100).toFixed(0)}%`,
    expl.missing.length
      ? `Faltando: ${expl.missing.join(", ")}`
      : "Nada crítico faltando no budget atual.",
    expl.alternativeInterpretations.length
      ? `Outras interpretações: ${expl.alternativeInterpretations.join("; ")}`
      : "",
    expl.executedAnything
      ? `Executou: ${expl.executedSummary}`
      : "Nenhuma ação operacional foi executada neste turno.",
    "",
    formatSourcesBlock(expl.sources),
  ]
    .filter(Boolean)
    .join("\n");
}

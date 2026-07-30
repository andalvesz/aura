/**
 * Opportunity Ranking Engine — ranks opportunity-like signals.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  LEVEL_SCORE,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionEngine } from "@/lib/decision-support/types/types";

export const opportunityRankingEngine: DecisionEngine = {
  id: "opportunity_ranking_v1",
  kind: "OPPORTUNITY",
  label: "Ranking de oportunidades",
  description: "Ordena oportunidades candidatas sem executar nenhuma.",
  analyze(context, options) {
    const max = options.max ?? 5;
    const scored = context.sources.discoveries
      .filter(
        (d) =>
          d.type === "OPPORTUNITY" &&
          !["REJECTED", "ARCHIVED", "SUPPRESSED"].includes(d.status ?? "")
      )
      .map((d) => {
        const impact = LEVEL_SCORE[(d.impact as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM"];
        const urgency = LEVEL_SCORE[(d.urgency as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM"];
        const score = d.confidence * 0.5 + impact * 15 + urgency * 10;
        return { d, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, max).map(({ d, score }, index) =>
      buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "opportunity_ranking_v1",
        kind: "OPPORTUNITY",
        title: `#${index + 1} Oportunidade: ${d.title}`,
        summary: d.summary || "Oportunidade ranqueada para consideração humana.",
        context: `Rank score composto ≈ ${Math.round(score)} (confiança + impacto + urgência).`,
        confidence: d.confidence,
        impact: (d.impact as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM",
        urgency: (d.urgency as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM",
        effort: "MEDIUM",
        reversibility: "MEDIUM",
        evidence: [
          makeEvidence({
            evidenceType: "ranked_opportunity",
            sourceLayer: "discovery",
            sourceType: d.type,
            sourceId: d.id,
            summary: d.summary || d.title,
            confidence: d.confidence,
          }),
          ...context.sources.knowledgeDocuments.slice(0, 1).map((doc) =>
            makeEvidence({
              evidenceType: "knowledge_context",
              sourceLayer: "knowledge",
              sourceType: doc.type,
              sourceId: doc.id,
              summary: doc.title,
              confidence: 45,
            })
          ),
        ],
        limitations: [
          "Ranking relativo — não é ordem de execução.",
          "Não cria iniciativas automaticamente.",
        ],
        alternativeOptions: [
          {
            id: "skip",
            title: "Não priorizar",
            summary: "Ignorar esta oportunidade por agora",
            pros: ["Foco"],
            cons: ["Oportunidade perdida"],
          },
          {
            id: "explore",
            title: "Explorar com cuidado",
            summary: "Investigar sem comprometer recursos",
            pros: ["Aprendizado"],
            cons: ["Custo de atenção"],
          },
        ],
        whyAppeared: `Oportunidade ranqueada na posição ${index + 1} pelo score composto.`,
        explanation:
          "Opportunity Ranking combina confiança, impacto e urgência dos sinais de discovery.",
        fingerprint: fingerprintOf("opportunity_ranking_v1", [d.id]),
        relatedDiscoveryIds: [d.id],
        relatedDocumentIds: context.sources.knowledgeDocuments
          .slice(0, 1)
          .map((x) => x.id),
      })
    );
  },
};
